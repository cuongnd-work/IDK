import { _decorator, Component, Slider, Label, math, Button, Node, NodeEventType } from 'cc';
import { ChefBehavior } from 'db://assets/scripts/ChefBehavior';
import { CountdownActivator } from 'db://assets/scripts/CountdownActivator';
const { ccclass, property } = _decorator;

@ccclass('SellCoinSlider')
export class SellCoinSlider extends Component {
    @property(Slider)
    public slider: Slider = null;

    @property(Label)
    public coinLabel: Label = null;

    @property({ tooltip: 'Gia tri coin nho nhat khi ban.' })
    public minCoin: number = 50;

    @property({ tooltip: 'Gia tri coin lon nhat khi ban.' })
    public maxCoin: number = 999;

    @property(Button)
    public confirmButton: Button = null;

    @property(Node)
    public confirmHideNode: Node = null;

    @property(Node)
    public confirmShowNode: Node = null;

    @property(Button)
    public secondaryButton: Button = null;

    @property(Node)
    public secondaryHideNode: Node = null;

    @property(Node)
    public secondaryShowNode: Node = null;

    @property({ type: Node, tooltip: 'Node se bat khi nguoi dung giu slider.' })
    public sliderHoldNode: Node = null;

    @property({ type: ChefBehavior, tooltip: 'Chef chinh nhan coin.' })
    public chefTarget: ChefBehavior = null;

    @property({ type: [ChefBehavior], tooltip: 'Chen cac chef khac cung nhan coin.' })
    public additionalChefTargets: ChefBehavior[] = [];

    @property({ tooltip: 'Giup khoa chef cho den khi bam confirm.' })
    public lockChefsUntilConfirm: boolean = true;

    @property({ type: [CountdownActivator], tooltip: 'Countdown chi bat dau sau khi bam confirm.' })
    public countdownActivators: CountdownActivator[] = [];

    @property({ tooltip: 'Neu true, moi lan bam confirm se reset countdown.' })
    public restartCountdownOnConfirm: boolean = false;

    private currentCoin: number = 50;
    private chefsUnlocked: boolean = false;
    private countdownStarted: boolean = false;

    protected onLoad(): void {
        this.ensureValidRange();
        if (!this.lockChefsUntilConfirm) {
            this.chefsUnlocked = true;
        }
        this.prepareCountdownsForManualStart();
    }

    protected onEnable(): void {
        this.registerSliderEvents();
        this.registerButtonEvents();
        this.refreshFromSlider();
        this.setSliderHoldNodeActive(false);
    }

    protected onDisable(): void {
        this.setSliderHoldNodeActive(false);
        this.unregisterSliderEvents();
        this.unregisterButtonEvents();
    }

    public get coinValue(): number {
        return this.currentCoin;
    }

    public set coinValue(value: number) {
        const [minValue, maxValue] = this.getRange();
        const clamped = math.clamp(value, minValue, maxValue);
        this.currentCoin = Math.round(clamped);
        this.updateSliderProgress();
        this.updateLabel();
        this.applyCoinValueToChef();
    }

    private registerSliderEvents(): void {
        if (!this.slider) {
            return;
        }
        this.slider.node.on('slide', this.handleSliderChanged, this);
        const touchTargets = this.getSliderTouchTargets();
        for (const target of touchTargets) {
            target.on(NodeEventType.TOUCH_START, this.handleSliderPressed, this);
            target.on(NodeEventType.TOUCH_END, this.handleSliderReleased, this);
            target.on(NodeEventType.TOUCH_CANCEL, this.handleSliderReleased, this);
        }
    }

    private registerButtonEvents(): void {
        if (this.confirmButton) {
            this.confirmButton.node.on(Button.EventType.CLICK, this.handleConfirmClicked, this);
        }
        if (this.secondaryButton) {
            this.secondaryButton.node.on(Button.EventType.CLICK, this.handleSecondaryClicked, this);
        }
    }

    private unregisterSliderEvents(): void {
        if (!this.slider) {
            return;
        }
        this.slider.node.off('slide', this.handleSliderChanged, this);
        const touchTargets = this.getSliderTouchTargets();
        for (const target of touchTargets) {
            target.off(NodeEventType.TOUCH_START, this.handleSliderPressed, this);
            target.off(NodeEventType.TOUCH_END, this.handleSliderReleased, this);
            target.off(NodeEventType.TOUCH_CANCEL, this.handleSliderReleased, this);
        }
    }

    private unregisterButtonEvents(): void {
        if (this.confirmButton) {
            this.confirmButton.node.off(Button.EventType.CLICK, this.handleConfirmClicked, this);
        }
        if (this.secondaryButton) {
            this.secondaryButton.node.off(Button.EventType.CLICK, this.handleSecondaryClicked, this);
        }
    }

    private refreshFromSlider(): void {
        if (!this.slider) {
            this.updateLabel();
            this.applyCoinValueToChef();
            return;
        }
        this.slider.progress = math.clamp01(this.slider.progress);
        this.currentCoin = this.evaluateCoin(this.slider.progress);
        this.updateLabel();
        this.applyCoinValueToChef();
    }

    private handleSliderChanged(): void {
        if (!this.slider) {
            return;
        }
        const normalized = math.clamp01(this.slider.progress);
        this.slider.progress = normalized;
        this.currentCoin = this.evaluateCoin(normalized);
        this.updateLabel();
        this.applyCoinValueToChef();
    }

    private handleConfirmClicked(): void {
        this.applyCoinValueToChef();
        this.toggleNodePair(this.confirmHideNode, this.confirmShowNode);
        this.unlockChefs();
        this.triggerCountdowns();
    }

    private handleSecondaryClicked(): void {
        this.toggleNodePair(this.secondaryHideNode, this.secondaryShowNode);
    }

    private handleSliderPressed(): void {
        this.setSliderHoldNodeActive(true);
    }

    private handleSliderReleased(): void {
        this.setSliderHoldNodeActive(false);
    }

    private evaluateCoin(normalized: number): number {
        const [minValue, maxValue] = this.getRange();
        if (maxValue === minValue) {
            return minValue;
        }
        const value = math.lerp(minValue, maxValue, normalized);
        return Math.round(value);
    }

    private updateSliderProgress(): void {
        if (!this.slider) {
            return;
        }
        const [minValue, maxValue] = this.getRange();
        const normalized = maxValue === minValue
            ? 0
            : (this.currentCoin - minValue) / (maxValue - minValue);
        this.slider.progress = math.clamp01(normalized);
    }

    private updateLabel(): void {
        if (!this.coinLabel) {
            return;
        }
        this.coinLabel.string = `${this.currentCoin}`;
    }

    private toggleNodePair(disableTarget?: Node | null, enableTarget?: Node | null): void {
        if (disableTarget) {
            disableTarget.active = false;
        }
        if (enableTarget) {
            enableTarget.active = true;
        }
    }

    private setSliderHoldNodeActive(active: boolean): void {
        if (!this.sliderHoldNode) {
            return;
        }
        this.sliderHoldNode.active = active;
    }

    private getSliderTouchTargets(): Node[] {
        if (!this.slider) {
            return [];
        }
        const targets: Node[] = [this.slider.node];
        const handleSprite = this.slider.handle;
        const handleNode = handleSprite ? handleSprite.node : null;
        if (handleNode && handleNode !== this.slider.node && !targets.includes(handleNode)) {
            targets.push(handleNode);
        }
        return targets;
    }

    private applyCoinValueToChef(): void {
        const targets = this.collectChefTargets();
        if (targets.length === 0) {
            return;
        }
        if (this.lockChefsUntilConfirm && !this.chefsUnlocked) {
            this.setChefEnabledState(targets, false);
        }
        for (const chef of targets) {
            chef.setSellCoinReward(this.currentCoin);
        }
    }

    private collectChefTargets(): ChefBehavior[] {
        const result: ChefBehavior[] = [];
        if (this.chefTarget) {
            result.push(this.chefTarget);
        }
        if (this.additionalChefTargets) {
            for (const chef of this.additionalChefTargets) {
                if (!chef) {
                    continue;
                }
                if (result.includes(chef)) {
                    continue;
                }
                result.push(chef);
            }
        }
        return result;
    }

    private setChefEnabledState(targets: ChefBehavior[], enable: boolean): void {
        for (const chef of targets) {
            if (!chef) {
                continue;
            }
            chef.enabled = enable;
        }
    }

    private unlockChefs(): void {
        if (this.chefsUnlocked) {
            return;
        }
        this.chefsUnlocked = true;
        const targets = this.collectChefTargets();
        if (targets.length === 0) {
            return;
        }
        this.setChefEnabledState(targets, true);
    }

    private triggerCountdowns(): void {
        if (!this.restartCountdownOnConfirm && this.countdownStarted) {
            return;
        }
        if (!this.countdownActivators || this.countdownActivators.length === 0) {
            return;
        }
        for (const activator of this.countdownActivators) {
            if (!activator) {
                continue;
            }
            activator.startCountdown();
        }
        this.countdownStarted = true;
    }

    private ensureValidRange(): void {
        if (this.minCoin === this.maxCoin) {
            return;
        }
        if (this.minCoin > this.maxCoin) {
            const temp = this.minCoin;
            this.minCoin = this.maxCoin;
            this.maxCoin = temp;
        }
        this.currentCoin = Math.round(this.minCoin);
    }

    private getRange(): [number, number] {
        return [Math.round(this.minCoin), Math.round(this.maxCoin)];
    }

    private prepareCountdownsForManualStart(): void {
        if (!this.countdownActivators) {
            return;
        }
        for (const activator of this.countdownActivators) {
            if (!activator) {
                continue;
            }
            activator.holdAtInitialValue();
        }
    }
}
