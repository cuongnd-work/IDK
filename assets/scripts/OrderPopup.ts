import { _decorator, Component, SpriteRenderer, SpriteFrame, Label, Node, EventHandler } from 'cc';
import { CustomersQueueEvents } from 'db://assets/scripts/customers/CustomersQueueEvents';
import { CatAnimationController } from 'db://assets/scripts/CatAnimationController';
import { WaveFloatMotion } from 'db://assets/scripts/WaveFloatMotion';
const { ccclass, property } = _decorator;

@ccclass('OrderPopup')
export class OrderPopup extends Component {

    @property(SpriteRenderer)
    targetSprite: SpriteRenderer = null!;

    @property(Label)
    text: Label = null!;

    @property(Node)
    parentss: Node = null!;

    @property([SpriteFrame])
    spriteFrames: SpriteFrame[] = [];

    @property({ tooltip: 'Luôn dùng sprite index 0' })
    alwaysUseFirst: boolean = false;

    @property({ tooltip: 'Số lượng món cần bán cho mèo trước khi rời hàng', min: 0 })
    initialCount: number = 1;

    @property({ type: [EventHandler], tooltip: 'Gọi EventHandler khi mèo hoàn thành order' })
    orderCompletedEvents: EventHandler[] = [];

    @property({ tooltip: 'Enable floating wave motion for this popup.' })
    public enableWaveFloat: boolean = true;

    @property({ tooltip: 'Leave empty to use this popup node.' })
    public waveTarget: Node = null;

    @property({ tooltip: 'Wave amplitude along the Y axis.', min: 0 })
    public waveAmplitude: number = 0.05;

    @property({ tooltip: 'Wave speed (cycles per second).', min: 0 })
    public waveSpeed: number = 1;

    @property({ tooltip: 'Randomize the phase so each popup floats differently.' })
    public waveRandomizePhase: boolean = true;

    private _remainingCount = 0;
    private countdownOverrideSprite: SpriteFrame | null = null;
    private countdownOverrideActive = false;

    start () {
        if (this.initialCount <= 0) {
            this.initialCount = 1;
        }
        this.resetCount();
        this.refreshSprite();

        if(this.alwaysUseFirst) {
            this.setupWaveFloatMotion();
            return;
        }

        this.parentss.active = false;

        const minDelay = 0;
        const maxDelay = 800;

        const randomMs = this.randomRange(minDelay, maxDelay);

        setTimeout(() => {
            this.parentss.active = true;
        }, 1500 + randomMs);

        this.setupWaveFloatMotion();
    }

    public randomRange(min: number, max: number): number {
        return Math.random() * (max - min) + min;
    }

    public sell(): boolean {
        if (this._remainingCount <= 0) {
            return false;
        }

        this._remainingCount = Math.max(0, this._remainingCount - 1);
        this.refreshCountLabel();

        const soldOut = this._remainingCount === 0;
        if (soldOut) {
            this.notifyOrderCompleted();
        }

        return soldOut;
    }

    public resetCount (value?: number): void {
        const target = typeof value === 'number' ? value : this.initialCount;
        this._remainingCount = Math.max(0, Math.floor(target));
        this.refreshCountLabel();
    }

    public isSoldOut (): boolean {
        return this._remainingCount <= 0;
    }

    private refreshCountLabel (): void {
        if (!this.text) {
            return;
        }

        this.text.string = this._remainingCount.toString();
    }

    public applyCountdownAppearance (sprite: SpriteFrame | null): void {
        if (!sprite || !this.targetSprite) {
            return;
        }
        if (!this.countdownOverrideActive) {
            this.countdownOverrideSprite = this.targetSprite.spriteFrame;
        }
        this.countdownOverrideActive = true;
        this.targetSprite.spriteFrame = sprite;
        if (this.text) {
            this.text.node.active = false;
        }
    }

    public resetCountdownAppearance (): void {
        if (!this.countdownOverrideActive) {
            return;
        }
        this.countdownOverrideActive = false;
        if (this.targetSprite && this.countdownOverrideSprite) {
            this.targetSprite.spriteFrame = this.countdownOverrideSprite;
        }
        this.countdownOverrideSprite = null;
        if (this.text) {
            this.text.node.active = true;
            this.refreshCountLabel();
        }
    }

    private setupWaveFloatMotion (): void {
        if (!this.enableWaveFloat) {
            return;
        }

        const target = this.waveTarget ?? this.node;
        if (!target) {
            return;
        }

        let motion = target.getComponent(WaveFloatMotion);
        if (!motion) {
            motion = target.addComponent(WaveFloatMotion);
        }

        motion.targetNode = target;
        motion.amplitude = this.waveAmplitude;
        motion.waveSpeed = this.waveSpeed;
        motion.randomizePhase = this.waveRandomizePhase;
        motion.reinitialize(true);

    }

    private notifyOrderCompleted (): void {
        const customerNode = this.findCustomerNode();
        if (customerNode) {
            CustomersQueueEvents.emitOrderCompleted(customerNode);
        }

        if (this.orderCompletedEvents.length > 0) {
            EventHandler.emitEvents(this.orderCompletedEvents, this);
        }
    }

    private findCustomerNode (): Node | null {
        let current: Node | null = this.node;
        while (current) {
            if (current.getComponent(CatAnimationController)) {
                return current;
            }

            current = current.parent;
        }

        return this.node;
    }

    /* ================= CORE ================= */

    public refreshSprite () {
        if (!this.targetSprite || this.spriteFrames.length === 0) {
            return;
        }

        let index = 0;

        if (!this.alwaysUseFirst) {
            index = Math.floor(Math.random() * this.spriteFrames.length);
        }

        this.targetSprite.spriteFrame = this.spriteFrames[index];
    }
}
