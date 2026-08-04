import { _decorator, Component, Node, Vec3, Quat, Mat4, EventHandler } from 'cc';
import { CatAnimationController } from './CatAnimationController';
import { CustomersQueueManager } from 'db://assets/scripts/customers/CustomersQueueManager';
import { CustomersQueueEvent, CustomersQueueEvents } from 'db://assets/scripts/customers/CustomersQueueEvents';
import {MoveTargetProvider} from "db://assets/scripts/MoveTargetProvider";
import { CurrencyView } from 'db://assets/scripts/CurrencyView';

const { ccclass, property } = _decorator;

enum ChefState {
    IdleBeforeCustomerPlacement,
    MoveToForge,
    ForgingLoop,
    Doing,
    MoveWithBedo,
    WaitAtPointB,
    MoveWithWalk,
}

@ccclass('ChefBehavior')
export class ChefBehavior extends Component {

    /* ================= TARGET ================= */

    @property(Node)
    pointA: Node = null!;

    @property(Node)
    pointB: Node = null!;

    private pointBListeners: Array<{ cb: (chef: ChefBehavior) => void; target?: unknown }> = [];

    /* ================= MOVE ================= */

    @property
    public speed = 5;

    @property
    public currentSpeed = 5;

    @property
    stopDistance = 0.2;

    @property({ tooltip: 'Base seconds the chef stays at point A before moving.' })
    public pointAWaitSeconds = 1;

    @property({ tooltip: 'Base seconds the chef stays at point B before returning.' })
    public pointBWaitSeconds = 0.75;

    /* ================= ROTATION ================= */

    @property
    rotationOffsetY = 180;

    @property(Node)
    hamburger: Node = null!;

    @property(Node)
    coin: Node = null!;

    @property({ tooltip: 'Giá trị coin nhận được mỗi lần đầu bếp bán món.' })
    public baseSellCoinReward: number = 10;

    /* ================= ANIM ================= */

    @property(CatAnimationController)
    animCtrl: CatAnimationController = null!;

    @property(CustomersQueueManager)
    queueManager: CustomersQueueManager = null;

    @property({ tooltip: 'Chỉ số hàng mèo mà đầu bếp phục vụ. Đặt -1 để tự động lấy theo mèo đầu tiên.' })
    columnIndex = -1;

    @property({ tooltip: 'Lane giao hàng cố định (leftTargets[index]). -1 = random.' })
    deliveryLaneIndex = -1;

    @property({ tooltip: 'Dung idle cho den khi customer di chuyen vao hang xong.' })
    public waitForCustomerInitialPlacement = true;

    @property({ tooltip: 'Sau khi vao vi tri ren thi chi ren lien tuc, khong be do sang pointB.' })
    public forgeContinuouslyWithoutDelivery = false;

    @property({ type: [Node], tooltip: 'Cac node UI se chi bat khi CatBase bat dau ren.' })
    public forgeStartEnableNodes: Node[] = [];

    /* ================= INTERNAL ================= */

    private _state: ChefState = ChefState.Doing;
    private _currentTarget: Node = null!;
    private _groundY = 0;

    private _dir = new Vec3();
    private _move = new Vec3();
    private _targetPos = new Vec3();

    private _invParentMat = new Mat4();
    private _localPos = new Vec3();

    private _invParentRot = new Quat();
    private _localDir = new Vec3();
    private _rotQuat = new Quat();
    private _lastSpeedForQueue = -1;
    private _sellCoinReward = 10;

    /* ================= LIFE ================= */

    protected onLoad (): void {
        this._sellCoinReward = this.normalizeSellCoinReward(this.baseSellCoinReward);
        CustomersQueueEvents.on(CustomersQueueEvent.ORDER_COMPLETED, this.onCustomerOrderCompleted, this);
    }

    protected onDestroy (): void {
        CustomersQueueEvents.off(CustomersQueueEvent.ORDER_COMPLETED, this.onCustomerOrderCompleted, this);
        this.queueManager?.unregisterAfterInitialPlacement(this.handleInitialCustomerPlacementComplete, this);
    }

    start (): void {
        this._groundY = this.node.worldPosition.y;
        this.hamburger.active = false;
        this.coin.active = false;
        if (this.forgeContinuouslyWithoutDelivery) {
            this.setForgeStartEnableNodes(false);
        }
        this.resolveQueueManagerReference();
        this.syncSpeedDependents();

        if (this.shouldWaitForInitialCustomerPlacement()) {
            this.enterIdleBeforeCustomerPlacement();
            this.queueManager?.registerAfterInitialPlacement(this.handleInitialCustomerPlacementComplete, this);
            return;
        }

        this.startWorkingFlow();
    }

    update (dt: number): void {
        if (this.currentSpeed !== this._lastSpeedForQueue) {
            this.syncSpeedDependents();
        }

        if (
            this._state === ChefState.MoveWithBedo ||
            this._state === ChefState.MoveWithWalk ||
            this._state === ChefState.MoveToForge
        ) {
            this.move3D(dt);
        }
    }

    /* ================= STATE ================= */

    private shouldWaitForInitialCustomerPlacement (): boolean {
        return this.waitForCustomerInitialPlacement &&
            !!this.queueManager &&
            !this.queueManager.hasStartedAfterInitialPlacement;
    }

    private handleInitialCustomerPlacementComplete = (): void => {
        this.startWorkingFlow();
    };

    private startWorkingFlow (): void {
        this.queueManager?.unregisterAfterInitialPlacement(this.handleInitialCustomerPlacementComplete, this);

        if (this.forgeContinuouslyWithoutDelivery) {
            this.moveToForgeAndLoop();
            return;
        }

        this._currentTarget = this.pointA;
        this.resolveColumnFromCurrentCustomer();
        this.assignFrontCustomer();
        this.enterDoing();
    }

    private enterIdleBeforeCustomerPlacement (): void {
        this._state = ChefState.IdleBeforeCustomerPlacement;
        this.hamburger.active = false;
        this.coin.active = false;
        this.animCtrl?.doIdle();
    }

    private moveToForgeAndLoop (): void {
        this.hamburger.active = false;
        this.coin.active = false;
        this._currentTarget = this.pointA;

        if (this.isAtTarget(this.pointA)) {
            this.enterForgingLoop();
            return;
        }

        this._state = ChefState.MoveToForge;
        this.animCtrl?.doRun();
    }

    private enterForgingLoop (): void {
        this._state = ChefState.ForgingLoop;
        this.hamburger.active = false;
        this.coin.active = false;
        this.setForgeStartEnableNodes(true);
        this.animCtrl?.doDoing();
    }

    private setForgeStartEnableNodes (active: boolean): void {
        for (const node of this.forgeStartEnableNodes ?? []) {
            if (!node) {
                continue;
            }
            node.active = active;
        }
    }

    private enterDoing (): void {
        const provider = MoveTargetProvider.instance;
        if (provider) {
            const laneIndex = this.deliveryLaneIndex >= 0 ? this.deliveryLaneIndex
                : this.columnIndex >= 0 ? this.columnIndex
                : -1;

            if (laneIndex >= 0) {
                const pair = provider.getTargetPairForColumn(laneIndex);
                if (pair.left) {
                    this.pointB = pair.left;
                }
                const targetAnim = this.animCtrl;
                if (targetAnim && pair.right) {
                    targetAnim.sellTargetPopup = pair.right;
                }
            }
            // laneIndex < 0: use scene-set pointB as-is (no random override)
        }

        this._state = ChefState.Doing;
        this.animCtrl.doDoing();

        const doingTime = this.getPointAWaitTime();

        this.scheduleOnce(() => {
            this._currentTarget = this.pointB;
            this.hamburger.active = true;
            this.enterMoveWithBedo();
        }, doingTime);
    }

    private getPointAWaitTime (): number {
        return this.getScaledDuration(this.pointAWaitSeconds);
    }

    private enterMoveWithBedo (): void {
        this.assignFrontCustomer();
        this._state = ChefState.MoveWithBedo;
        this.animCtrl.doBedo();
    }

    private enterMoveWithWalk (): void {
        this._state = ChefState.MoveWithWalk;
        this.animCtrl.doWalk();
        this.hamburger.active = false;

        this.coin.active = true;
        this.rewardSale();

        if (this.currentSpeed >= 10) {
            return;
        }
        setTimeout(() => {
            this.coin.active = false;
        }, 1000);
    }

    private waitAtPointB (): void {
        this._state = ChefState.WaitAtPointB;
        const delay = this.getPointBWaitTime();
        if (delay <= 0) {
            this.resumeFromPointB();
            return;
        }

        this.scheduleOnce(() => {
            this.resumeFromPointB();
        }, delay);
    }

    private resumeFromPointB (): void {
        this._currentTarget = this.pointA;
        this.enterMoveWithWalk();
    }

    private getPointBWaitTime (): number {
        return this.getScaledDuration(this.pointBWaitSeconds);
    }

    private getScaledDuration (baseDuration: number): number {
        const clampedBase = Math.max(0, baseDuration);
        if (clampedBase <= 0) {
            return 0;
        }

        const baseSpeed = Math.max(0.01, this.speed);
        const current = Math.max(0.01, this.currentSpeed);
        return clampedBase * (baseSpeed / current);
    }

    public applySpeedBoost (percentIncrease: number): void {
        const normalized = Math.max(0, percentIncrease);
        if (normalized <= 0) {
            return;
        }

        const multiplier = 1 + normalized;
        this.currentSpeed = Math.max(0.01, this.currentSpeed * multiplier);
        this.syncSpeedDependents();
    }

    /* ================= COIN ================= */

    public setSellCoinReward (amount: number): void {
        this._sellCoinReward = this.normalizeSellCoinReward(amount);
    }

    public getSellCoinReward (): number {
        return this._sellCoinReward;
    }

    private normalizeSellCoinReward (value: number): number {
        if (typeof value !== 'number' || Number.isNaN(value)) {
            return this._sellCoinReward;
        }
        return Math.max(0, Math.round(value));
    }

    private rewardSale (): void {
        const reward = this.getSellCoinReward();
        if (reward <= 0) {
            return;
        }

        const view = CurrencyView.instance;
        if (!view) {
            return;
        }

        view.addCurrency(reward);
    }

    /* ================= CUSTOMER ================= */

    private resolveColumnFromCurrentCustomer (): void {
        const manager = this.resolveQueueManagerReference();
        if (this.columnIndex >= 0 || !manager || !this.animCtrl) {
            if (this.columnIndex < 0 && !manager) {
            }
            return;
        }

        const detectedIndex = manager.getColumnIndexForNode(this.animCtrl.node);
        if (detectedIndex >= 0) {
            this.columnIndex = detectedIndex;
        } else {
        }
    }

    private assignFrontCustomer (): void {
        this.resolveColumnFromCurrentCustomer();

        const manager = this.resolveQueueManagerReference();
        if (!manager || this.columnIndex < 0) {
            return;
        }

        const frontNode = manager.getFrontCustomerNode(this.columnIndex);
        if (!frontNode) {
            return;
        }

        const nextCtrl = frontNode.getComponent(CatAnimationController);
        if (!nextCtrl || nextCtrl === this.animCtrl) {
            if (!nextCtrl) {
            } else {
            }
            return;
        }

        this.animCtrl = nextCtrl;
        this.updateQueueAdvanceSpeed();
    }

    private onCustomerOrderCompleted (customerNode: Node): void {
        const manager = this.resolveQueueManagerReference();
        if (!manager || !this.animCtrl) {
            return;
        }

        const resolved = manager.resolveCustomerNode(customerNode);
        if (!resolved || resolved !== this.animCtrl.node) {
            return;
        }

        this.scheduleOnce(() => {
            this.assignFrontCustomer();
        }, 0);
    }

    private resolveQueueManagerReference (): CustomersQueueManager | null {
        if (this.queueManager) {
            return this.queueManager;
        }

        let current: Node | null = this.node;
        while (current) {
            const manager = current.getComponent(CustomersQueueManager);
            if (manager) {
                this.queueManager = manager;
                return manager;
            }
            current = current.parent;
        }

        const scene = this.node.scene;
        if (scene) {
            const manager = scene.getComponentInChildren(CustomersQueueManager);
            if (manager) {
                this.queueManager = manager;
                return manager;
            }
        }

        return null;
    }

    private updateQueueAdvanceSpeed (): void {
        const manager = this.resolveQueueManagerReference();
        if (!manager || this.columnIndex < 0) {
            return;
        }

        const base = Math.max(0.1, this.speed);
        const ratio = Math.max(0.1, this.currentSpeed) / base;
        manager.setColumnAdvanceMultiplier(this.columnIndex, ratio);
    }

    private updateAnimationPlaybackSpeed (): void {
        if (!this.animCtrl) {
            return;
        }

        const base = Math.max(0.01, this.speed);
        const multiplier = Math.max(0.01, this.currentSpeed) / base;
        this.animCtrl.setAnimationSpeedMultiplier(multiplier);
    }

    private syncSpeedDependents (): void {
        this._lastSpeedForQueue = this.currentSpeed;
        this.updateQueueAdvanceSpeed();
        this.updateAnimationPlaybackSpeed();
    }

    /* ================= MOVE ================= */

    private move3D (dt: number): void {
        const pos = this.node.worldPosition;
        this._currentTarget.getWorldPosition(this._targetPos);
        this._targetPos.y = pos.y;

        Vec3.subtract(this._dir, this._targetPos, pos);
        const distance = this._dir.length();

        const maxStep = this.currentSpeed * dt;

        if (distance <= maxStep || distance <= this.stopDistance) {
            this.setWorldPosKeepLocalY0(this._targetPos);
            this.onReachTarget();
            return;
        }

        this._dir.normalize();
        this.rotateLocalToWorldDir(this._dir);

        Vec3.multiplyScalar(this._move, this._dir, maxStep);
        Vec3.add(this._move, pos, this._move);

        this.setWorldPosKeepLocalY0(this._move);
    }

    private setWorldPosKeepLocalY0 (worldPos: Vec3): void {
        const parent = this.node.parent;
        if (!parent) {
            this.node.setPosition(worldPos.x, 0, worldPos.z);
            return;
        }

        Mat4.invert(this._invParentMat, parent.worldMatrix);
        Vec3.transformMat4(this._localPos, worldPos, this._invParentMat);
        this._localPos.y = 0;
        this.node.setPosition(this._localPos);
    }

    /* ================= ROTATE ================= */

    private rotateLocalToWorldDir (worldDir: Vec3): void {
        const parent = this.node.parent;

        if (parent) {
            Quat.invert(this._invParentRot, parent.worldRotation);
            Vec3.transformQuat(this._localDir, worldDir, this._invParentRot);
        } else {
            this._localDir.set(worldDir);
        }

        const angleY = Math.atan2(this._localDir.x, this._localDir.z) * 180 / Math.PI;

        Quat.fromEuler(
            this._rotQuat,
            0,
            angleY + this.rotationOffsetY,
            0
        );

        this.node.setRotation(this._rotQuat);
    }

    /* ================= TARGET ================= */

    private onReachTarget (): void {
        if (this._state === ChefState.MoveToForge) {
            this.enterForgingLoop();
        }
        else if (this._state === ChefState.MoveWithBedo) {
            this.emitPointBReached();
            this.waitAtPointB();
        }
        else if (this._state === ChefState.MoveWithWalk) {
            this.enterDoing();
        }
    }

    private isAtTarget (target: Node | null): boolean {
        if (!target) {
            return true;
        }

        const pos = this.node.worldPosition;
        target.getWorldPosition(this._targetPos);
        this._targetPos.y = pos.y;
        return Vec3.squaredDistance(pos, this._targetPos) <= this.stopDistance * this.stopDistance;
    }

    private emitPointBReached(): void {
        if (!this.pointBListeners || this.pointBListeners.length === 0) {
            return;
        }
        for (const entry of this.pointBListeners) {
            if (!entry || typeof entry.cb !== 'function') {
                continue;
            }
            entry.cb.call(entry.target, this);
        }
    }

    public registerPointBListener(callback: (chef: ChefBehavior) => void, target?: unknown): void {
        if (!callback) {
            return;
        }
        this.pointBListeners.push({ cb: callback, target });
    }

    public unregisterPointBListener(callback: (chef: ChefBehavior) => void, target?: unknown): void {
        if (!callback || !this.pointBListeners) {
            return;
        }
        this.pointBListeners = this.pointBListeners.filter(entry => entry.cb !== callback || entry.target !== target);
    }
}
