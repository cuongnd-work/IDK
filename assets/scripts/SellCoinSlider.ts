import { _decorator, Component, Slider, Label, math, Button, Node, NodeEventType, Color } from 'cc';
import { ChefBehavior } from 'db://assets/scripts/ChefBehavior';
import { CountdownActivator } from 'db://assets/scripts/CountdownActivator';
import { CustomersQueueManager } from 'db://assets/scripts/customers/CustomersQueueManager';
import { TusButton } from 'db://assets/scripts/TusButton';
const { ccclass, property } = _decorator;

const DIFFICULTY_LABELS = ['Easy', 'Medium', 'Hard'];
const DIFFICULTY_STEP_COUNT = DIFFICULTY_LABELS.length - 1;

type ManualCustomerQueue = CustomersQueueManager & {
    holdInitialPlacementUntilManualStart?: () => void;
    startInitialPlacementFlow?: () => void;
};

@ccclass('SellCoinSlider')
export class SellCoinSlider extends Component {
    @property(Slider)
    public slider: Slider = null;

    @property(Label)
    public coinLabel: Label = null;

    @property({ type: [Label], tooltip: 'Danh sach label cung nhan gia tri coin.' })
    public coinLabels: Label[] = [];

    @property({ tooltip: 'Gia tri coin nho nhat khi ban.' })
    public minCoin: number = 50;

    @property({ tooltip: 'Gia tri coin lon nhat khi ban.' })
    public maxCoin: number = 999;

    @property({ tooltip: 'Difficulty mac dinh: 0 Easy, 1 Medium, 2 Hard.' })
    public defaultDifficultyIndex: number = 0;

    @property({ tooltip: 'Mau text Easy.' })
    public easyTextColor: Color = new Color(70, 210, 90, 255);

    @property({ tooltip: 'Mau text Medium.' })
    public mediumTextColor: Color = new Color(255, 205, 70, 255);

    @property({ tooltip: 'Mau text Hard.' })
    public hardTextColor: Color = new Color(255, 85, 70, 255);

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

    @property({ tooltip: 'Customer queue chi bat dau sau khi bam confirm.' })
    public lockCustomerQueuesUntilConfirm: boolean = true;

    @property({ type: [CustomersQueueManager], tooltip: 'Cac customer queue se duoc bat dau sau khi bam confirm. Neu de trong se tu tim trong scene.' })
    public customerQueueManagers: CustomersQueueManager[] = [];

    @property({ type: [CountdownActivator], tooltip: 'Countdown chi bat dau sau khi bam confirm.' })
    public countdownActivators: CountdownActivator[] = [];

    @property({ tooltip: 'Neu true, moi lan bam confirm se reset countdown.' })
    public restartCountdownOnConfirm: boolean = false;

    private currentCoin: number = 50;
    private currentDifficultyIndex: number = 0;
    private chefsUnlocked: boolean = false;
    private countdownStarted: boolean = false;
    private customerQueuesStarted: boolean = false;
    private hasAppliedInitialDifficulty: boolean = false;

    protected onLoad(): void {
        this.ensureValidRange();
        this.applyDifficultyIndex(this.defaultDifficultyIndex);
        if (!this.lockChefsUntilConfirm) {
            this.chefsUnlocked = true;
        }
        this.prepareCustomerQueuesForManualStart();
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
        this.applyDifficultyIndex(this.getClosestDifficultyIndexForCoin(value));
    }

    public get difficultyValue(): string {
        return this.getCurrentDifficultyLabel();
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
        if (!this.hasAppliedInitialDifficulty) {
            this.hasAppliedInitialDifficulty = true;
            this.applyDifficultyIndex(this.defaultDifficultyIndex);
            return;
        }

        if (!this.slider) {
            this.updateLabel();
            this.applyCoinValueToChef();
            return;
        }

        this.applyDifficultyIndex(this.evaluateDifficultyIndex(this.slider.progress));
    }

    private handleSliderChanged(): void {
        if (!this.slider) {
            return;
        }
        this.hasAppliedInitialDifficulty = true;
        this.applyDifficultyIndex(this.evaluateDifficultyIndex(this.slider.progress));
    }

    private handleConfirmClicked(): void {
        this.processConfirmation(this.confirmHideNode, this.confirmShowNode);
    }

    private handleSecondaryClicked(): void {
        this.processConfirmation(this.secondaryHideNode, this.secondaryShowNode);
    }

    private processConfirmation(hideNode?: Node | null, showNode?: Node | null): void {
        this.toggleNodePair(hideNode, showNode);
        this.startRuntimeFlow();
    }

    public startRuntimeFlow(): void {
        this.applyCoinValueToChef();
        this.unlockChefs();
        this.showUpgradeButtons();
        this.triggerCustomerQueues();
        this.triggerCountdowns();
    }

    private handleSliderPressed(): void {
        this.setSliderHoldNodeActive(true);
    }

    private handleSliderReleased(): void {
        this.updateSliderProgress();
        this.setSliderHoldNodeActive(false);
    }

    private evaluateDifficultyIndex(normalized: number): number {
        return math.clamp(Math.round(math.clamp01(normalized) * DIFFICULTY_STEP_COUNT), 0, DIFFICULTY_STEP_COUNT);
    }

    private applyDifficultyIndex(index: number): void {
        this.currentDifficultyIndex = this.normalizeDifficultyIndex(index);
        this.currentCoin = this.evaluateCoinForDifficulty(this.currentDifficultyIndex);
        this.updateSliderProgress();
        this.updateLabel();
        this.applyCoinValueToChef();
    }

    private normalizeDifficultyIndex(index: number): number {
        const value = Number.isFinite(index) ? index : 0;
        return math.clamp(Math.round(value), 0, DIFFICULTY_STEP_COUNT);
    }

    private evaluateCoinForDifficulty(index: number): number {
        const [minValue, maxValue] = this.getRange();
        if (maxValue === minValue) {
            return minValue;
        }

        const normalized = DIFFICULTY_STEP_COUNT <= 0
            ? 0
            : math.clamp(index, 0, DIFFICULTY_STEP_COUNT) / DIFFICULTY_STEP_COUNT;
        const value = math.lerp(minValue, maxValue, normalized);
        return Math.round(value);
    }

    private updateSliderProgress(): void {
        if (!this.slider) {
            return;
        }
        this.slider.progress = DIFFICULTY_STEP_COUNT <= 0
            ? 0
            : this.currentDifficultyIndex / DIFFICULTY_STEP_COUNT;
    }

    private updateLabel(): void {
        if (this.coinLabel) {
            this.coinLabel.string = this.getCurrentDifficultyLabel();
            this.coinLabel.color = this.getCurrentDifficultyColor();
        }

        const coinString = `${this.currentCoin}`;
        for (const label of this.coinLabels ?? []) {
            if (!label || label === this.coinLabel) {
                continue;
            }
            label.string = coinString;
        }
    }

    private getCurrentDifficultyLabel(): string {
        return DIFFICULTY_LABELS[this.currentDifficultyIndex] ?? DIFFICULTY_LABELS[0];
    }

    private getCurrentDifficultyColor(): Color {
        if (this.currentDifficultyIndex === 1) {
            return this.mediumTextColor.clone();
        }
        if (this.currentDifficultyIndex === 2) {
            return this.hardTextColor.clone();
        }
        return this.easyTextColor.clone();
    }

    private getClosestDifficultyIndexForCoin(value: number): number {
        const normalizedValue = Number.isFinite(value) ? value : this.currentCoin;
        let closestIndex = 0;
        let closestDistance = Number.MAX_VALUE;

        for (let index = 0; index < DIFFICULTY_LABELS.length; index++) {
            const distance = Math.abs(this.evaluateCoinForDifficulty(index) - normalizedValue);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestIndex = index;
            }
        }

        return closestIndex;
    }

    public setCoinLabelTargets(labels: (Label | null | undefined)[]): void {
        this.coinLabels.length = 0;
        if (!labels) {
            this.updateLabel();
            return;
        }
        for (const label of labels) {
            if (!label) {
                continue;
            }
            if (this.coinLabels.includes(label)) {
                continue;
            }
            this.coinLabels.push(label);
        }
        this.updateLabel();
    }

    private collectCoinLabelTargets(): Label[] {
        const result: Label[] = [];
        if (this.coinLabel) {
            result.push(this.coinLabel);
        }
        if (this.coinLabels) {
            for (const label of this.coinLabels) {
                if (!label) {
                    continue;
                }
                if (result.includes(label)) {
                    continue;
                }
                result.push(label);
            }
        }
        return result;
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

    private prepareCustomerQueuesForManualStart(): void {
        if (!this.lockCustomerQueuesUntilConfirm) {
            return;
        }

        const queues = this.collectCustomerQueues();
        for (const queue of queues) {
            (queue as ManualCustomerQueue).holdInitialPlacementUntilManualStart?.();
        }
    }

    private triggerCustomerQueues(): void {
        if (!this.lockCustomerQueuesUntilConfirm || this.customerQueuesStarted) {
            return;
        }

        const queues = this.collectCustomerQueues();
        for (const queue of queues) {
            (queue as ManualCustomerQueue).startInitialPlacementFlow?.();
        }

        this.customerQueuesStarted = true;
    }

    private collectCustomerQueues(): CustomersQueueManager[] {
        const result: CustomersQueueManager[] = [];

        this.addCustomerQueues(result, this.customerQueueManagers);

        for (const chef of this.collectChefTargets()) {
            if (!chef?.queueManager) {
                continue;
            }
            this.addCustomerQueue(result, chef.queueManager);
        }

        const sceneQueues = this.node.scene?.getComponentsInChildren(CustomersQueueManager) ?? [];
        this.addCustomerQueues(result, sceneQueues);

        return result;
    }

    private addCustomerQueues(target: CustomersQueueManager[], queues: CustomersQueueManager[] | null | undefined): void {
        for (const queue of queues ?? []) {
            this.addCustomerQueue(target, queue);
        }
    }

    private addCustomerQueue(target: CustomersQueueManager[], queue: CustomersQueueManager | null | undefined): void {
        if (!queue || target.includes(queue)) {
            return;
        }

        target.push(queue);
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

    private showUpgradeButtons(): void {
        const buttons = this.node.scene?.getComponentsInChildren(TusButton) ?? [];
        for (const button of buttons) {
            button.startRuntimeFlow();
        }
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
        this.applyDifficultyIndex(this.currentDifficultyIndex);
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
