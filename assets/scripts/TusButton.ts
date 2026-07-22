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
    UIOpacity
} from 'cc';
import { zoom_button } from "db://assets/scripts/zoom_button";
import { ChefBehavior } from "./ChefBehavior";
import super_html_script from "db://assets/plugins/playable-foundation/super-html/super_html_script";
import {CurrencyView} from "db://assets/scripts/CurrencyView";
import {object_pool_manager} from "db://assets/plugins/playable-foundation/game-foundation/object_pool";
import {super_html_playable} from "db://assets/plugins/playable-foundation/super-html/super_html_playable";

const { ccclass, property } = _decorator;

@ccclass('TusButton')
export class TusButton extends Component {
    private static readonly DEFAULT_SPEED_EFFECT_DURATION = 0.6;

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

    private _count: number = 0;

    @property({ tooltip: 'Số lần click cần thiết worker' })
    public countWorkerMax: number = 3;

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
    private speedClickCount: number = 0;
    private workerClickCount: number = 0;

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

        if (this.hand && this.handTarget2) {
            this.hand.setPosition(this.handTarget2.position);
        }

        this.workerClicked = false;
        this.speedClickCount = 0;
        this.workerClickCount = 0;
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

    /* ================= CLICK ================= */

    public ButtonSpeedClicker (): void {
        if(this.isCompleted) return;

        if (this.speedClickCount >= this.getRequiredSpeedClickCount()) {
            this.refreshButtonAvailability();
            this.hideHandTemporarily();
            return;
        }

        if(!CurrencyView.instance.trySubtractCurrency(this.speedCostAmount)) return;

        this.playClickSound();
        object_pool_manager.instance.Spawn(this.flash, new Vec3(0,0,0), null, this.flashParent);

        this._count++;
        this.speedClickCount++;
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

        if (this.speedClickCount < this.getRequiredSpeedClickCount()) {
            return;
        }

        if (this.workerClickCount < this.getRequiredWorkerClickCount()) {
            return;
        }

        this.completeUpgradeFlow();
    }

    private completeUpgradeFlow(): void {
        this.isCompleted = true;
        this.stopHandLoop();
        this.unschedule(this.restoreHandVisibility);
        if (this.hand) {
            this.hand.active = false;
        }

        this.setUpgradeButtonsVisible(false);
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

    private applySpeedBoost (target: ChefBehavior | null, effectIndex: number): void {
        if (!target) {
            return;
        }

        target.applySpeedBoost(0.10);
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
        if (!this.hand || !this.handTarget || !this.handTarget2 || !this.handInitiallyActive) {
            return;
        }

        this.stopHandLoop();
        this.hand.active = true;

        const button1Position = this.handTarget2.position.clone();
        const button2Position = this.handTarget.position.clone();
        this.hand.setPosition(button1Position);
        this.playHandButtonBounce(this.buttonSpeed?.node ?? null, true);

        this.handLoopTween = tween(this.hand)
            .repeatForever(
                tween<Node>()
                    .delay(Math.max(0, this.handPauseDuration))
                    .to(Math.max(0.01, this.handMoveDuration), { position: button2Position.clone() }, { easing: 'sineInOut' })
                    .call(() => this.playHandButtonBounce(this.buttonWorker?.node ?? null, false))
                    .delay(Math.max(0, this.handPauseDuration))
                    .to(Math.max(0.01, this.handMoveDuration), { position: button1Position.clone() }, { easing: 'sineInOut' })
                    .call(() => this.playHandButtonBounce(this.buttonSpeed?.node ?? null, true))
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
        this.applyButtonState(this.buttonSpeed, this.canUseSpeedButton(), this.canReceiveUpgradeButtonClick());
        this.applyButtonState(this.buttonWorker, this.canUseWorkerButton(), this.canReceiveUpgradeButtonClick());
    }

    private canUseSpeedButton(): boolean {
        const currency = CurrencyView.instance;
        return !this.isCompleted &&
            this.runtimeFlowStarted &&
            this.speedClickCount < this.getRequiredSpeedClickCount() &&
            !!currency &&
            currency.canAfford(this.speedCostAmount);
    }

    private canUseWorkerButton(): boolean {
        const currency = CurrencyView.instance;
        return !this.isCompleted &&
            this.runtimeFlowStarted &&
            this.workerClickCount < this.getRequiredWorkerClickCount() &&
            !!currency &&
            currency.canAfford(this.workerCostAmount);
    }

    private getRequiredSpeedClickCount(): number {
        return Math.max(0, Math.floor(this.countMax));
    }

    private getRequiredWorkerClickCount(): number {
        return Math.max(0, Math.floor(this.countWorkerMax));
    }

    private canReceiveUpgradeButtonClick(): boolean {
        return this.runtimeFlowStarted && !this.isCompleted;
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
