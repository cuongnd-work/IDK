import { _decorator, Component, Label, Node, Color, UIOpacity, tween, Tween, Animation, SpriteFrame, Button, input, Input, director } from 'cc';
import { OrderPopup } from 'db://assets/scripts/OrderPopup';
import super_html_script from 'db://assets/plugins/playable-foundation/super-html/super_html_script';
const { ccclass, property } = _decorator;

@ccclass('CountdownActivator')
export class CountdownActivator extends Component {
    private static lastStoreTriggerFrame = -1;

    @property({ tooltip: 'Thời gian đếm ngược (giây).' })
    public countdownSeconds = 30;

    @property({ tooltip: 'Node sẽ được bật khi đếm ngược về 0.' })
    public targetNode: Node | null = null;

    @property({ type: [Node], tooltip: 'Các node bổ sung được bật khi đếm ngược về 0.' })
    public additionalEnableNodes: Node[] = [];

    @property({ type: [Animation], tooltip: 'Các Animation phát khi đếm ngược kết thúc.' })
    public completeAnimations: Animation[] = [];

    @property({ type: [OrderPopup], tooltip: 'Danh sách OrderPopup sẽ đổi sprite ở những giây cuối.' })
    public trackedOrderPopups: OrderPopup[] = [];

    @property(SpriteFrame)
    public finalSecondsSprite: SpriteFrame | null = null;

    @property({ tooltip: 'Đổi sprite khi thời gian còn lại nhỏ hơn hoặc bằng giá trị này.' })
    public finalSecondsThreshold = 5;

    @property({ tooltip: 'Độ trễ giữa mỗi OrderPopup đổi sprite (giây).' })
    public orderPopupSequentialDelay = 0.05;

    @property(Label)
    public countdownLabel: Label | null = null;

    @property({ tooltip: 'Tự động chạy khi node bật.' })
    public autoStart = false;

    @property(Button)
    public countdownButton1: Button | null = null;

    @property(Button)
    public countdownButton2: Button | null = null;

    @property({ tooltip: 'Deprecated: sau khi countdown xong, click o bat ky dau cung trigger store.' })
    public requireSpeedGateForStore = true;

    private remainingTime = 0;
    private isRunning = false;
    private defaultLabelColor: Color | null = null;
    private readonly urgentColor: Color = new Color(255, 64, 64, 255);
    private labelOpacity: UIOpacity | null = null;
    private blinkTween: Tween<UIOpacity> | null = null;
    private isInUrgentState = false;
    private hasAppliedOrderPopupSprite = false;
    private popupOverrideQueue: OrderPopup[] = [];
    private currentPopupOverrideIndex = 0;
    private isCountdownFinished = false;
    private globalTouchRegistered = false;
    private readonly storeButtonTouchNodes: Node[] = [];

    protected onEnable(): void {
        this.bindGlobalStoreTouch();
        this.bindStoreButtonTouches();
        this.isCountdownFinished = false;

        if (this.autoStart) {
            this.startCountdown();
            return;
        }

        this.remainingTime = Math.max(0, this.countdownSeconds);
        this.updateLabel();
        this.setUrgentState(false);
        this.setCountdownTargetsActive(false);
        this.resetOrderPopupAppearance();
    }

    protected onDisable(): void {
        this.unbindGlobalStoreTouch();
        this.unbindStoreButtonTouches();
        this.stopCountdown();
        this.isCountdownFinished = false;
        this.setCountdownTargetsActive(false);
        this.resetOrderPopupAppearance();
    }

    public startCountdown(duration?: number): void {
        this.stopCountdown();

        this.isCountdownFinished = false;
        this.remainingTime = Math.max(0, typeof duration === 'number' ? duration : this.countdownSeconds);
        this.isRunning = this.remainingTime > 0;
        this.setUrgentState(false);
        this.setCountdownTargetsActive(false);
        this.resetOrderPopupAppearance();

        this.updateLabel();
        if (this.isRunning) {
            this.schedule(this.handleTick, 0.016);
        } else {
            this.finishCountdown();
        }
    }

    public stopCountdown(): void {
        this.stopTicking();
        this.clearPopupOverrideQueue();
        this.setUrgentState(false);
        this.resetOrderPopupAppearance();
    }

    public holdAtInitialValue(): void {
        this.stopCountdown();
        this.isCountdownFinished = false;
        this.remainingTime = Math.max(0, this.countdownSeconds);
        this.updateLabel();
        this.setCountdownTargetsActive(false);
    }

    private handleTick(dt: number): void {
        if (!this.isRunning) {
            return;
        }

        this.remainingTime = Math.max(0, this.remainingTime - dt);
        this.updateLabel();

        if (this.remainingTime <= 0) {
            this.finishCountdown();
        }
    }

    private finishCountdown(): void {
        this.stopTicking();
        this.isCountdownFinished = true;
        this.remainingTime = 0;
        this.updateLabel();
        this.setUrgentState(false);
        this.setCountdownTargetsActive(true);
        this.bindStoreButtonTouches();
        this.playCompletionAnimations();
        // this.node.active = false;
    }

    private stopTicking(): void {
        this.unschedule(this.handleTick);
        this.isRunning = false;
    }

    private updateLabel(): void {
        if (!this.countdownLabel) {
            return;
        }

        this.ensureLabelHelpers();
        const secondsLeft = Math.max(0, Math.ceil(this.remainingTime));
        this.countdownLabel.string = this.formatTime(secondsLeft);
        this.updateUrgentState(secondsLeft);
        this.updateOrderPopupCountdown(secondsLeft);
    }

    private ensureLabelHelpers(): void {
        if (!this.countdownLabel) {
            return;
        }

        if (!this.defaultLabelColor) {
            this.defaultLabelColor = this.countdownLabel.color.clone();
        }

        if (!this.labelOpacity) {
            this.labelOpacity = this.countdownLabel.getComponent(UIOpacity) ?? this.countdownLabel.node.addComponent(UIOpacity);
        }
    }

    private formatTime(totalSeconds: number): string {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = Math.max(0, totalSeconds - minutes * 60);
        return `${this.padTime(minutes)}:${this.padTime(seconds)}`;
    }

    private padTime(value: number): string {
        return value.toString().padStart(2, '0');
    }

    private updateUrgentState(secondsLeft: number): void {
        const shouldBeUrgent = secondsLeft > 0 && secondsLeft <= 10;
        this.setUrgentState(shouldBeUrgent);
    }

    private setUrgentState(enable: boolean): void {
        if (this.isInUrgentState === enable) {
            return;
        }

        this.isInUrgentState = enable;
        if (enable) {
            this.applyUrgentVisuals();
        } else {
            this.resetUrgentVisuals();
        }
    }

    private applyUrgentVisuals(): void {
        if (!this.countdownLabel) {
            return;
        }

        this.ensureLabelHelpers();
        this.countdownLabel.color = this.urgentColor.clone();

        if (!this.labelOpacity) {
            return;
        }

        this.labelOpacity.opacity = 255;
        this.stopBlinkTween();
        this.blinkTween = tween(this.labelOpacity)
            .repeatForever(
                tween().to(0.35, { opacity: 80 }).to(0.35, { opacity: 255 })
            )
            .start();
    }

    private resetUrgentVisuals(): void {
        if (!this.countdownLabel) {
            this.stopBlinkTween();
            return;
        }

        this.ensureLabelHelpers();

        if (this.defaultLabelColor) {
            this.countdownLabel.color = this.defaultLabelColor.clone();
        }

        if (this.labelOpacity) {
            this.labelOpacity.opacity = 255;
        }

        this.stopBlinkTween();
    }

    private stopBlinkTween(): void {
        if (this.blinkTween) {
            this.blinkTween.stop();
            this.blinkTween = null;
        }
    }

    private setCountdownTargetsActive(active: boolean): void {
        if (this.targetNode) {
            this.targetNode.active = active;
        }

        for (const node of this.additionalEnableNodes ?? []) {
            if (!node) {
                continue;
            }
            node.active = active;
        }
    }

    private playCompletionAnimations(): void {
        for (const anim of this.completeAnimations ?? []) {
            anim?.play();
        }
    }

    private bindGlobalStoreTouch(): void {
        if (this.globalTouchRegistered) {
            return;
        }

        input.on(Input.EventType.TOUCH_START, this.onGlobalStoreTouch, this);
        input.on(Input.EventType.MOUSE_DOWN, this.onGlobalStoreTouch, this);
        this.globalTouchRegistered = true;
    }

    private unbindGlobalStoreTouch(): void {
        if (!this.globalTouchRegistered) {
            return;
        }

        input.off(Input.EventType.TOUCH_START, this.onGlobalStoreTouch, this);
        input.off(Input.EventType.MOUSE_DOWN, this.onGlobalStoreTouch, this);
        this.globalTouchRegistered = false;
    }

    private onGlobalStoreTouch(): void {
        this.tryTriggerStore();
    }

    private bindStoreButtonTouches(): void {
        const scene = this.node.scene;
        if (!scene) {
            return;
        }

        this.bindStoreButtonTouchesRecursive(scene);
    }

    private bindStoreButtonTouchesRecursive(node: Node): void {
        if (node.getComponent(Button)) {
            this.bindStoreButtonTouch(node);
        }

        for (const child of node.children) {
            this.bindStoreButtonTouchesRecursive(child);
        }
    }

    private bindStoreButtonTouch(node: Node): void {
        if (this.storeButtonTouchNodes.includes(node)) {
            return;
        }

        node.on(Node.EventType.TOUCH_START, this.onStoreButtonTouch, this);
        this.storeButtonTouchNodes.push(node);
    }

    private unbindStoreButtonTouches(): void {
        for (const node of this.storeButtonTouchNodes) {
            if (!node || !node.isValid) {
                continue;
            }

            node.off(Node.EventType.TOUCH_START, this.onStoreButtonTouch, this);
        }

        this.storeButtonTouchNodes.length = 0;
    }

    private onStoreButtonTouch(): void {
        this.tryTriggerStore();
    }

    public tryTriggerStore(): boolean {
        if (!this.isCountdownFinished) {
            return false;
        }

        const currentFrame = director.getTotalFrames();
        if (CountdownActivator.lastStoreTriggerFrame === currentFrame) {
            return false;
        }

        CountdownActivator.lastStoreTriggerFrame = currentFrame;
        super_html_script.on_click_download("timeout_click");
        return true;
    }

    private updateOrderPopupCountdown(secondsLeft: number): void {
        if (!this.finalSecondsSprite || !this.trackedOrderPopups || this.trackedOrderPopups.length === 0) {
            return;
        }

        const threshold = Math.max(1, Math.floor(this.finalSecondsThreshold));
        if (secondsLeft > 0 && secondsLeft <= threshold) {
            this.startSequentialPopupOverride();
        } else if (secondsLeft > threshold) {
            this.resetOrderPopupAppearance();
        }
    }

    private startSequentialPopupOverride(): void {
        if (this.hasAppliedOrderPopupSprite) {
            return;
        }

        const validPopups = (this.trackedOrderPopups ?? []).filter((popup) => !!popup);
        if (validPopups.length === 0) {
            return;
        }

        this.clearPopupOverrideQueue();
        this.hasAppliedOrderPopupSprite = true;
        this.popupOverrideQueue = validPopups.sort(() => Math.random() - 0.5);
        this.currentPopupOverrideIndex = 0;

        this.applyPopupOverrideStep();
        if (this.popupOverrideQueue.length > this.currentPopupOverrideIndex) {
            const delay = Math.max(0.01, this.orderPopupSequentialDelay);
            this.schedule(this.applyPopupOverrideStep, delay);
        }
    }

    private applyPopupOverrideStep = (): void => {
        if (!this.popupOverrideQueue || this.popupOverrideQueue.length === 0) {
            this.clearPopupOverrideQueue();
            return;
        }

        if (!this.finalSecondsSprite) {
            this.clearPopupOverrideQueue();
            return;
        }

        if (this.currentPopupOverrideIndex >= this.popupOverrideQueue.length) {
            this.clearPopupOverrideQueue();
            return;
        }

        const popup = this.popupOverrideQueue[this.currentPopupOverrideIndex];
        popup?.applyCountdownAppearance(this.finalSecondsSprite);
        this.currentPopupOverrideIndex++;

        if (this.currentPopupOverrideIndex >= this.popupOverrideQueue.length) {
            this.clearPopupOverrideQueue();
        }
    };

    private clearPopupOverrideQueue(): void {
        this.unschedule(this.applyPopupOverrideStep);
        this.popupOverrideQueue = [];
        this.currentPopupOverrideIndex = 0;
    }

    private resetOrderPopupAppearance(): void {
        if (!this.hasAppliedOrderPopupSprite && this.popupOverrideQueue.length === 0) {
            this.clearPopupOverrideQueue();
            return;
        }

        this.clearPopupOverrideQueue();
        this.hasAppliedOrderPopupSprite = false;

        for (const popup of this.trackedOrderPopups ?? []) {
            popup?.resetCountdownAppearance();
        }
    }
}
