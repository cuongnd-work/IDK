import { _decorator, Component, Slider, Label, math, Button, Node } from 'cc';
import { ChefBehavior } from 'db://assets/scripts/ChefBehavior';
const { ccclass, property } = _decorator;

@ccclass('SellCoinSlider')
export class SellCoinSlider extends Component {
    @property(Slider)
    public slider: Slider = null;

    @property(Label)
    public coinLabel: Label = null;

    @property({ tooltip: 'Giá trị coin nhỏ nhất nhận được khi bán.' })
    public minCoin: number = 50;

    @property({ tooltip: 'Giá trị coin lớn nhất nhận được khi bán.' })
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

    @property({ type: ChefBehavior, tooltip: 'Chef chính nhận coin. Có thể để trống nếu dùng danh sách bên dưới.' })
    public chefTarget: ChefBehavior = null;

    @property({ type: [ChefBehavior], tooltip: 'Thêm các chef khác cũng nhận được coin.' })
    public additionalChefTargets: ChefBehavior[] = [];

    @property({ tooltip: 'Giữ ChefBehavior ở trạng thái tắt cho đến khi nhấn nút confirm.' })
    public lockChefsUntilConfirm: boolean = true;

    private currentCoin: number = 50;
    private chefsUnlocked: boolean = false;

    protected onLoad(): void {
        this.ensureValidRange();
        if (!this.lockChefsUntilConfirm) {
            this.chefsUnlocked = true;
        }
    }

    protected onEnable(): void {
        this.registerSliderEvents();
        this.registerButtonEvents();
        this.refreshFromSlider();
    }

    protected onDisable(): void {
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
    }

    private handleSecondaryClicked(): void {
        this.toggleNodePair(this.secondaryHideNode, this.secondaryShowNode);
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
        if (this.additionalChefTargets && this.additionalChefTargets.length > 0) {
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
}
