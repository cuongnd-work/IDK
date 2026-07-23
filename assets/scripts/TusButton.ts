import {
    _decorator,
    Button,
    Component,
    Sprite,
    Node,
    Vec3,
    tween,
    Tween,
    AudioSource,
    AudioClip,
    Prefab,
    Animation,
    UIOpacity,
    Label,
    UITransform,
    Color,
    Camera,
    Canvas,
    Layers
} from 'cc';
import { zoom_button } from "db://assets/scripts/zoom_button";
import { ChefBehavior } from "./ChefBehavior";
import super_html_script from "db://assets/plugins/playable-foundation/super-html/super_html_script";
import {CurrencyView} from "db://assets/scripts/CurrencyView";
import { tracking_service } from "db://assets/plugins/playable-foundation/tracking/tracking_service";
import {object_pool_manager} from "db://assets/plugins/playable-foundation/game-foundation/object_pool";
import {super_html_playable} from "db://assets/plugins/playable-foundation/super-html/super_html_playable";

const { ccclass, property } = _decorator;

type HandButtonTarget = {
    handNode: Node;
    buttonNode: Node;
    isSpeedButton: boolean;
};

@ccclass('TusButton')
export class TusButton extends Component {
    private static readonly DEFAULT_SPEED_EFFECT_DURATION = 0.6;
    private static readonly SPEED_TEXT_NODE_NAME = 'SpeedBoostText';
    private static readonly SPEED_BOOST_PERCENT = 0.05;

    @property(Button)
    public buttonSpeed: Button = null!;

    @property(Button)
    public buttonWorker: Button = null!;

    @property({ tooltip: 'An 2 button nang cap cho den khi runtime flow duoc start.' })
    public hideUpgradeButtonsUntilRuntimeStart: boolean = true;

    @property(Node)
    public hand: Node = null!;

    @property({ tooltip: 'Thoi gian (giay) khong tuong tac truoc khi hien lai hand.' })
    public handReappearDelay: number = 3;

    @property({ tooltip: 'Thoi gian hand di chuyen giua 2 button.' })
    public handMoveDuration: number = 0.55;

    @property({ tooltip: 'Thoi gian hand dung lai o moi button truoc khi di tiep.' })
    public handPauseDuration: number = 0.25;

    @property({ tooltip: 'Scale button khi hand di den.' })
    public handButtonBounceScale: number = 1.12;

    @property({ tooltip: 'Thoi gian moi nhip nay cua button.' })
    public handButtonBounceDuration: number = 0.12;

    @property({ tooltip: 'Alpha cua nut khi khong con bam duoc.' })
    public disabledButtonAlpha: number = 120;

    @property(ChefBehavior)
    public chefBehavior: ChefBehavior = null!;

    @property(ChefBehavior)
    public chefWorkerBehavior: ChefBehavior = null!;

    @property(Node)
    public handTarget: Node = null!;

    @property(Node)
    public handTarget2: Node = null!;

    @property({ type: [Node], tooltip: 'Node bai len cho tung Chef sau khi nang cap speed (thu tu giong danh sach Chef).' })
    public chefSpeedNodes: Node[] = [];

    @property(Node)
    public end: Node = null!;

    @property(Animation)
    public endAnim: Animation = null!;

    @property(Prefab)
    flash: Prefab = null!;

    @property(Node)
    public flashParent: Node = null!;

    @property(zoom_button)
    public zoom_button1: zoom_button = null!;

    @property(zoom_button)
    public zoom_button2: zoom_button = null!;

    /* ================= SOUND ================= */

    @property(AudioSource)
    public audioSource: AudioSource = null!;

    @property(AudioClip)
    public clickSound: AudioClip = null!;

    @property({ tooltip: 'Số lần click cần thiết' })
    public countMax: number = 8;

    @property({ tooltip: 'So lan speed boost toi da moi Chef co the nhan.' })
    public maxSpeedBoostClicksPerChef: number = 40;

    private _count: number = 0;

    @property({ tooltip: 'Số lần click cần thiết worker' })
    public countWorkerMax: number = 1;

    private readonly speedCostAmount: number = 5;
    private readonly workerCostAmount: number = 15;

    private readonly currencyChangeHandler = () => {
        this.refreshButtonAvailability();
    };

    private handInitiallyActive: boolean = true;
    private speedEffectPlayTokens: number[] = [];
    private handLoopTween: Tween<Node> | null = null;
    private buttonSpeedBounceTween: Tween<Node> | null = null;
    private buttonWorkerBounceTween: Tween<Node> | null = null;
    private readonly buttonSpeedInitialScale = new Vec3();
    private readonly buttonWorkerInitialScale = new Vec3();
    private buttonsRegistered: boolean = false;
    private runtimeFlowStarted: boolean = false;
    private currentHandTargetIsSpeed: boolean | null = null;
    private speedClickCount: number = 0;
    private workerClickCount: number = 0;
    private readonly speedBoostCountsByChef = new Map<string, number>();
    private readonly speedTextWorldPos = new Vec3();
    private readonly speedTextScreenPos = new Vec3();
    private readonly speedTextUIWorldPos = new Vec3();
    private cachedCanvas: Canvas | null = null;
    private cachedWorldCamera: Camera | null = null;
    private cachedUICamera: Camera | null = null;

    /* ================= LIFE ================= */

    protected onLoad(): void {
        if (this.hand) {
            this.handInitiallyActive = this.hand.active;
        }
        this.buttonSpeed?.node.getScale(this.buttonSpeedInitialScale);
        this.buttonWorker?.node.getScale(this.buttonWorkerInitialScale);
    }

    start () {
        this.registerButtonEvents();
        this.zoom_button1.stopZoomAndReset();
        this.zoom_button2.stopZoomAndReset();

        this.setSpriteAlpha(this.zoom_button1.node, 255);
        this.setSpriteAlpha(this.zoom_button2.node, 255);

        if (this.hand && this.handTarget) {
            this.hand.setPosition(this.handTarget.position);
        }

        this.workerClicked = false;
        this.speedClickCount = 0;
        this.workerClickCount = 0;
        this.speedBoostCountsByChef.clear();
        this.isCompleted = false;
        this.setChefSpeedNodesActive(false);
        if (this.end) {
            this.end.active = false;
        }
        if (this.hideUpgradeButtonsUntilRuntimeStart) {
            this.setUpgradeButtonsVisible(false);
        } else {
            this.runtimeFlowStarted = true;
        }

        CurrencyView.onCurrencyChanged(this.currencyChangeHandler, this);
        this.refreshButtonAvailability();
        if (this.runtimeFlowStarted) {
            this.startHandLoop();
        }
    }

    public isCompleted: boolean = false;

    public startRuntimeFlow(): void {
        if (this.runtimeFlowStarted) {
            return;
        }

        this.runtimeFlowStarted = true;
        this.setUpgradeButtonsVisible(true);
        this.refreshButtonAvailability();
        this.startHandLoop();
    }

    public hasReachedSpeedStoreGate(): boolean {
        return this.speedClickCount >= this.getRequiredSpeedClickCount();
    }

    /* ================= CLICK ================= */

    public ButtonSpeedClicker (): void {
        if (!this.runtimeFlowStarted) {
            return;
        }

        const canApplySpeedBoost = this.canApplySpeedBoostToAnyTarget();
        if (canApplySpeedBoost && !CurrencyView.instance.trySubtractCurrency(this.speedCostAmount)) {
            return;
        }

        if (canApplySpeedBoost) {
            tracking_service.trackInteraction("speed_button", {
                click_count: this.speedClickCount + 1,
                required_click_count: this.getRequiredSpeedClickCount(),
                cost: this.speedCostAmount,
            }, { countRaw: false });
        }

        this.playClickSound();
        object_pool_manager.instance.Spawn(this.flash, new Vec3(0,0,0), null, this.flashParent);

        this._count++;
        if (canApplySpeedBoost && this.speedClickCount < this.getRequiredSpeedClickCount()) {
            this.speedClickCount++;
        }
        this.applySpeedBoost(this.chefBehavior, 0);
        this.applySpeedBoost(this.chefWorkerBehavior, 1);
        this.refreshButtonAvailability();
        this.tryCompleteUpgradeFlow();
        if (this.isCompleted) {
            return;
        }
        this.hideHandTemporarily();
    }

    private workerClicked: boolean = false;

    @property(Node)
    public worker: Node = null;

    public ButtonWorkerClicker (): void {
        if (this.workerClickCount >= this.getRequiredWorkerClickCount()) {
            this.refreshButtonAvailability();
            return;
        }

        if(!CurrencyView.instance.trySubtractCurrency(this.workerCostAmount)) return;

        tracking_service.trackInteraction("worker_button", {
            click_count: this.workerClickCount + 1,
            required_click_count: this.getRequiredWorkerClickCount(),
            cost: this.workerCostAmount,
        }, { countRaw: false });

        this.playClickSound();

        this.workerClickCount++;
        this.workerClicked = this.workerClickCount >= this.getRequiredWorkerClickCount();

        if (this.worker) {
            this.worker.active = true;
        }

        this.refreshButtonAvailability();
        this.tryCompleteUpgradeFlow();
        if (this.isCompleted) {
            return;
        }

        this.zoom_button1.stopZoomAndReset();
        this.zoom_button2.stopZoomAndReset();

        this.setSpriteAlpha(this.zoom_button2.node, 255);
        this.setSpriteAlpha(this.zoom_button1.node, 255);

        if (!this.handInitiallyActive) {
            this.restoreHandVisibility();
        } else {
            this.hideHandTemporarily();
            this.restoreHandVisibility();
        }
    }

    private tryCompleteUpgradeFlow(): void {
        if (this.isCompleted || !this.runtimeFlowStarted) {
            return;
        }

        if (this.workerClickCount < this.getRequiredWorkerClickCount()) {
            return;
        }

        if (this.canApplySpeedBoostToAnyTarget()) {
            return;
        }

        this.completeUpgradeFlow();
    }

    private completeUpgradeFlow(): void {
        this.isCompleted = true;
        tracking_service.trackInteraction("upgrade_complete", {
            speed_click_count: this.speedClickCount,
            worker_click_count: this.workerClickCount,
        }, { countRaw: false });
        this.stopHandLoop();
        this.unschedule(this.restoreHandVisibility);
        if (this.hand) {
            this.hand.active = false;
        }

        this.refreshButtonAvailability();

        if (this.end) {
            this.end.active = true;
        }

        this.endAnim?.play();
    }

    /* ================= SOUND ================= */

    private playClickSound () {
        if (!this.audioSource || !this.clickSound) return;

        this.audioSource.playOneShot(this.clickSound, 1);
    }

    private applySpeedBoost(target: ChefBehavior | null, effectIndex: number): void {
        if (!this.isValidSpeedBoostTarget(target)) {
            return;
        }

        if (target && this.canApplySpeedBoostToTarget(target)) {
            target.applySpeedBoost(TusButton.SPEED_BOOST_PERCENT);
            this.incrementSpeedBoostCount(target);
        }
        this.playChefSpeedEffect(effectIndex);
    }

    private setChefSpeedNodesActive(active: boolean): void {
        if (!this.chefSpeedNodes) {
            return;
        }
        for (const node of this.chefSpeedNodes) {
            if (!node) {
                continue;
            }
            node.active = active;
        }
    }

    private playChefSpeedEffect(effectIndex: number): void {
        if (!this.chefSpeedNodes || effectIndex < 0 || effectIndex >= this.chefSpeedNodes.length) {
            return;
        }

        const node = this.chefSpeedNodes[effectIndex];
        if (!node) {
            return;
        }

        const token = (this.speedEffectPlayTokens[effectIndex] ?? 0) + 1;
        this.speedEffectPlayTokens[effectIndex] = token;
        node.active = true;
        this.playSpeedBoostText(node, effectIndex);

        const animation = node.getComponent(Animation) ?? node.getComponentInChildren(Animation);
        let hideDelay = TusButton.DEFAULT_SPEED_EFFECT_DURATION;

        if (animation) {
            animation.stop();
            const clip = animation.defaultClip ?? animation.clips?.[0] ?? null;
            if (clip && clip.duration > 0) {
                hideDelay = clip.duration;
            }
            animation.play();
        }

        this.scheduleOnce(() => {
            if (!node.isValid) {
                return;
            }

            if ((this.speedEffectPlayTokens[effectIndex] ?? 0) !== token) {
                return;
            }

            node.active = false;
        }, Math.max(0.01, hideDelay));
    }

    private startHandLoop(): void {
        if (!this.hand || !this.handInitiallyActive) {
            return;
        }

        const target = this.getAvailableHandTarget();
        if (!target) {
            this.stopHandLoop();
            this.hand.active = false;
            return;
        }

        this.stopHandLoop();
        this.hand.active = true;
        this.currentHandTargetIsSpeed = target.isSpeedButton;
        this.hand.setPosition(target.handNode.position);
        this.playHandButtonBounce(target.buttonNode, target.isSpeedButton);

        this.handLoopTween = tween(this.hand)
            .repeatForever(
                tween<Node>()
                    .delay(Math.max(0.01, this.handPauseDuration + this.handMoveDuration))
                    .call(() => this.refreshCurrentHandTarget())
            )
            .start();
    }

    private stopHandLoop(resetButtons: boolean = true): void {
        if (this.handLoopTween) {
            this.handLoopTween.stop();
            this.handLoopTween = null;
        }

        this.stopHandButtonBounce(this.buttonSpeed?.node ?? null, true, resetButtons);
        this.stopHandButtonBounce(this.buttonWorker?.node ?? null, false, resetButtons);
        this.currentHandTargetIsSpeed = null;
    }

    private refreshCurrentHandTarget(): void {
        if (!this.hand) {
            return;
        }

        const target = this.getAvailableHandTarget();
        if (!target) {
            this.stopHandLoop();
            this.hand.active = false;
            return;
        }

        if (target.isSpeedButton !== this.currentHandTargetIsSpeed) {
            this.startHandLoop();
            return;
        }

        this.hand.setPosition(target.handNode.position);
        this.playHandButtonBounce(target.buttonNode, target.isSpeedButton);
    }

    private syncHandTargetWithAvailability(): void {
        if (!this.runtimeFlowStarted || this.isCompleted || !this.hand || !this.handInitiallyActive) {
            return;
        }

        if (!this.hand.active && !this.handLoopTween) {
            return;
        }

        this.startHandLoop();
    }

    private getAvailableHandTarget(): HandButtonTarget | null {
        if (this.canHighlightWorkerButton() && this.handTarget && this.buttonWorker?.node) {
            return {
                handNode: this.handTarget,
                buttonNode: this.buttonWorker.node,
                isSpeedButton: false,
            };
        }

        if (this.canHighlightSpeedButton() && this.handTarget2 && this.buttonSpeed?.node) {
            return {
                handNode: this.handTarget2,
                buttonNode: this.buttonSpeed.node,
                isSpeedButton: true,
            };
        }

        return null;
    }

    private playHandButtonBounce(buttonNode: Node | null, isSpeedButton: boolean): void {
        if (!buttonNode) {
            return;
        }

        this.stopHandButtonBounce(buttonNode, isSpeedButton, true);

        const initialScale = isSpeedButton ? this.buttonSpeedInitialScale : this.buttonWorkerInitialScale;
        const targetScale = new Vec3(
            initialScale.x * this.handButtonBounceScale,
            initialScale.y * this.handButtonBounceScale,
            initialScale.z * this.handButtonBounceScale
        );

        const bounceTween = tween(buttonNode)
            .to(Math.max(0.01, this.handButtonBounceDuration), { scale: targetScale }, { easing: 'quadOut' })
            .to(Math.max(0.01, this.handButtonBounceDuration), { scale: initialScale.clone() }, { easing: 'quadIn' })
            .start();

        if (isSpeedButton) {
            this.buttonSpeedBounceTween = bounceTween;
        } else {
            this.buttonWorkerBounceTween = bounceTween;
        }
    }

    private stopHandButtonBounce(buttonNode: Node | null, isSpeedButton: boolean, resetScale: boolean): void {
        const bounceTween = isSpeedButton ? this.buttonSpeedBounceTween : this.buttonWorkerBounceTween;
        if (bounceTween) {
            bounceTween.stop();
            if (isSpeedButton) {
                this.buttonSpeedBounceTween = null;
            } else {
                this.buttonWorkerBounceTween = null;
            }
        }

        if (!buttonNode || !resetScale) {
            return;
        }

        buttonNode.setScale(isSpeedButton ? this.buttonSpeedInitialScale : this.buttonWorkerInitialScale);
    }

    /* ================= UTILS ================= */

    private setSpriteAlpha (node: Node, alpha: number) {
        const sprite = node.getComponentInChildren(Sprite);
        if (!sprite) return;

        const c = sprite.color.clone();
        c.a = alpha;
        sprite.color = c;
    }

    private refreshButtonAvailability () {
        const canReceiveClick = this.canReceiveUpgradeButtonClick();
        this.applyButtonState(this.buttonSpeed, canReceiveClick, canReceiveClick);
        this.applyButtonState(this.buttonWorker, canReceiveClick && this.canHighlightWorkerButton(), canReceiveClick);
        this.syncHandTargetWithAvailability();
    }

    private getRequiredSpeedClickCount(): number {
        return Math.max(0, Math.floor(this.countMax));
    }

    private getRequiredWorkerClickCount(): number {
        return Math.max(0, Math.floor(this.countWorkerMax));
    }

    private canReceiveUpgradeButtonClick(): boolean {
        return this.runtimeFlowStarted;
    }

    private canHighlightSpeedButton(): boolean {
        return this.runtimeFlowStarted && !this.isCompleted && this.canApplySpeedBoostToAnyTarget();
    }

    private canHighlightWorkerButton(): boolean {
        return this.runtimeFlowStarted && !this.isCompleted && this.workerClickCount < this.getRequiredWorkerClickCount();
    }

    private canApplySpeedBoostToAnyTarget(): boolean {
        return this.canApplySpeedBoostToTarget(this.chefBehavior) || this.canApplySpeedBoostToTarget(this.chefWorkerBehavior);
    }

    private canApplySpeedBoostToTarget(target: ChefBehavior | null): boolean {
        if (!this.isValidSpeedBoostTarget(target)) {
            return false;
        }

        return this.getSpeedBoostCount(target) < this.getMaxSpeedBoostClicksPerChef();
    }

    private isValidSpeedBoostTarget(target: ChefBehavior | null): target is ChefBehavior {
        return !!target && !!target.node && target.node.activeInHierarchy;
    }

    private getMaxSpeedBoostClicksPerChef(): number {
        return Math.max(0, Math.floor(this.maxSpeedBoostClicksPerChef));
    }

    private getSpeedBoostCount(target: ChefBehavior): number {
        return this.speedBoostCountsByChef.get(this.getChefSpeedBoostKey(target)) ?? 0;
    }

    private incrementSpeedBoostCount(target: ChefBehavior): void {
        const key = this.getChefSpeedBoostKey(target);
        this.speedBoostCountsByChef.set(key, this.getSpeedBoostCount(target) + 1);
    }

    private getChefSpeedBoostKey(target: ChefBehavior): string {
        return target.node?.uuid ?? `${target}`;
    }

    private applyButtonState (btn: Button, visuallyActive: boolean, interactable: boolean) {
        if (!btn) return;
        btn.interactable = interactable;
        this.setNodeOpacity(btn.node.parent ?? btn.node, visuallyActive ? 255 : this.disabledButtonAlpha);
    }

    private setNodeOpacity(node: Node, alpha: number): void {
        const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
        opacity.opacity = Math.max(0, Math.min(255, Math.round(alpha)));
    }

    private playSpeedBoostText(target: Node, effectIndex: number): void {
        const textNode = this.getOrCreateSpeedBoostText(effectIndex);
        if (!this.positionSpeedBoostText(textNode, target)) {
            return;
        }

        const opacity = textNode.getComponent(UIOpacity) ?? textNode.addComponent(UIOpacity);

        Tween.stopAllByTarget(textNode);
        Tween.stopAllByTarget(opacity);

        textNode.active = true;
        textNode.setScale(1, 1, 1);
        opacity.opacity = 255;

        const startPos = textNode.position.clone();
        const endPos = new Vec3(startPos.x, startPos.y + 70, startPos.z);
        tween(textNode)
            .to(0.12, { scale: new Vec3(1.15, 1.15, 1.15) }, { easing: 'backOut' })
            .parallel(
                tween<Node>().to(0.55, { position: endPos }, { easing: 'quadOut' }),
                tween<Node>().delay(0.22).to(0.33, { scale: new Vec3(1, 1, 1) }, { easing: 'quadIn' })
            )
            .start();

        tween(opacity)
            .delay(0.25)
            .to(0.3, { opacity: 0 }, { easing: 'quadIn' })
            .call(() => {
                textNode.active = false;
            })
            .start();
    }

    private getOrCreateSpeedBoostText(effectIndex: number): Node {
        const uiParent = this.getSpeedBoostUIParent();
        const nodeName = `${TusButton.SPEED_TEXT_NODE_NAME}-${effectIndex}`;
        let textNode = uiParent.getChildByName(nodeName);
        if (!textNode) {
            textNode = new Node(nodeName);
            textNode.layer = Layers.Enum.UI_2D;
            uiParent.addChild(textNode);
            textNode.addComponent(UITransform).setContentSize(110, 30);

            const label = textNode.addComponent(Label);
            label.string = 'Speed++';
            label.fontSize = 21;
            label.lineHeight = 23;
            label.color = new Color(255, 245, 64, 255);
            label.isBold = true;
            label.horizontalAlign = Label.HorizontalAlign.CENTER;
            label.verticalAlign = Label.VerticalAlign.CENTER;
            this.applySpeedBoostTextFont(label);
            this.applySpeedBoostTextOutline(label);
        } else {
            const label = textNode.getComponent(Label);
            if (label) {
                label.string = 'Speed++';
                label.fontSize = 21;
                label.lineHeight = 23;
                this.applySpeedBoostTextFont(label);
                this.applySpeedBoostTextOutline(label);
            }
        }

        return textNode;
    }

    private applySpeedBoostTextFont(label: Label): void {
        const sourceLabel =
            this.buttonSpeed?.node.getComponentInChildren(Label) ??
            this.buttonWorker?.node.getComponentInChildren(Label) ??
            null;

        if (sourceLabel?.font) {
            label.font = sourceLabel.font;
            (label as unknown as { isSystemFontUsed?: boolean }).isSystemFontUsed = false;
        }
    }

    private applySpeedBoostTextOutline(label: Label): void {
        const outlineLabel = label as unknown as {
            enableOutline?: boolean;
            outlineColor?: Color;
            outlineWidth?: number;
        };

        outlineLabel.enableOutline = true;
        outlineLabel.outlineColor = new Color(0, 0, 0, 255);
        outlineLabel.outlineWidth = 2;
    }

    private positionSpeedBoostText(textNode: Node, target: Node): boolean {
        const worldCamera = this.resolveWorldCamera();
        const uiCamera = this.resolveUICamera();
        if (!worldCamera || !uiCamera) {
            return false;
        }

        target.getWorldPosition(this.speedTextWorldPos);
        this.speedTextWorldPos.y += 1.15;
        worldCamera.worldToScreen(this.speedTextWorldPos, this.speedTextScreenPos);
        if (this.speedTextScreenPos.z <= 0) {
            textNode.active = false;
            return false;
        }

        uiCamera.screenToWorld(this.speedTextScreenPos, this.speedTextUIWorldPos);
        textNode.setWorldPosition(this.speedTextUIWorldPos);
        return true;
    }

    private getSpeedBoostUIParent(): Node {
        const canvas = this.getCanvas();
        return canvas?.node ?? this.node;
    }

    private resolveWorldCamera(): Camera | null {
        if (this.cachedWorldCamera && this.cachedWorldCamera.node && this.cachedWorldCamera.node.isValid) {
            return this.cachedWorldCamera;
        }

        const scene = this.node.scene;
        if (!scene) {
            return null;
        }

        const uiCam = this.resolveUICamera();
        const cameras = scene.getComponentsInChildren(Camera);
        for (const cam of cameras) {
            if (!cam.enabled || !cam.node.activeInHierarchy) {
                continue;
            }
            if (cam === uiCam) {
                continue;
            }
            if ((cam.visibility & Layers.BitMask.UI_2D) !== 0) {
                continue;
            }
            this.cachedWorldCamera = cam;
            return cam;
        }

        return null;
    }

    private resolveUICamera(): Camera | null {
        if (this.cachedUICamera && this.cachedUICamera.node && this.cachedUICamera.node.isValid) {
            return this.cachedUICamera;
        }

        const canvas = this.getCanvas();
        if (canvas && canvas.cameraComponent) {
            this.cachedUICamera = canvas.cameraComponent;
            return canvas.cameraComponent;
        }

        const scene = this.node.scene;
        if (!scene) {
            return null;
        }

        const cameras = scene.getComponentsInChildren(Camera);
        for (const cam of cameras) {
            if (!cam.enabled || !cam.node.activeInHierarchy) {
                continue;
            }
            if ((cam.visibility & Layers.BitMask.UI_2D) !== 0) {
                this.cachedUICamera = cam;
                return cam;
            }
        }

        return null;
    }

    private getCanvas(): Canvas | null {
        if (this.cachedCanvas && this.cachedCanvas.isValid) {
            return this.cachedCanvas;
        }

        const scene = this.node.scene;
        if (!scene) {
            return null;
        }

        const canvas = scene.getComponentInChildren(Canvas);
        this.cachedCanvas = canvas ?? null;
        return this.cachedCanvas;
    }

    private setUpgradeButtonsVisible(visible: boolean): void {
        this.setButtonRootVisible(this.buttonSpeed, visible);
        this.setButtonRootVisible(this.buttonWorker, visible);

        if (!visible) {
            this.stopHandLoop();
            if (this.hand) {
                this.hand.active = false;
            }
        }
    }

    private setButtonRootVisible(button: Button | null, visible: boolean): void {
        const root = button?.node.parent ?? button?.node ?? null;
        if (!root) {
            return;
        }

        root.active = visible;
    }

    private registerButtonEvents(): void {
        if (this.buttonsRegistered) {
            return;
        }

        this.buttonSpeed?.node.on(Button.EventType.CLICK, this.ButtonSpeedClicker, this);
        this.buttonWorker?.node.on(Button.EventType.CLICK, this.ButtonWorkerClicker, this);
        this.buttonsRegistered = true;
    }

    private unregisterButtonEvents(): void {
        if (!this.buttonsRegistered) {
            return;
        }

        this.buttonSpeed?.node.off(Button.EventType.CLICK, this.ButtonSpeedClicker, this);
        this.buttonWorker?.node.off(Button.EventType.CLICK, this.ButtonWorkerClicker, this);
        this.buttonsRegistered = false;
    }

    private hideHandTemporarily(): void {
        if (!this.hand) {
            return;
        }
        this.stopHandLoop();
        this.hand.active = false;
        this.unschedule(this.restoreHandVisibility);
        const delay = Math.max(0, this.handReappearDelay);
        if (delay <= 0) {
            this.restoreHandVisibility();
            return;
        }
        this.scheduleOnce(this.restoreHandVisibility, delay);
    }

    private restoreHandVisibility(): void {
        if (!this.hand) {
            return;
        }
        this.hand.active = this.handInitiallyActive;
        this.startHandLoop();
    }

    onDestroy () {
        this.unregisterButtonEvents();
        this.stopHandLoop();
        this.unschedule(this.restoreHandVisibility);
        CurrencyView.offCurrencyChanged(this.currencyChangeHandler, this);
    }
}
