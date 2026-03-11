import { _decorator, Component, Label, Node, Color, UIOpacity, tween, Tween, Animation } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('CountdownActivator')
export class CountdownActivator extends Component {
    @property({ tooltip: 'Thời gian đếm ngược (giây).' })
    public countdownSeconds: number = 30;

    @property({ tooltip: 'Node sẽ được bật khi đếm ngược về 0.' })
    public targetNode: Node = null;

    @property({ type: [Node], tooltip: 'Danh sách node được bật thêm khi đếm ngược hoàn tất.' })
    public additionalEnableNodes: Node[] = [];

    @property({ type: [Animation], tooltip: 'Các Animation sẽ được phát khi đếm ngược kết thúc.' })
    public completeAnimations: Animation[] = [];

    @property(Label)
    public countdownLabel: Label = null;

    @property({ tooltip: 'Tự động bắt đầu khi node bật.' })
    public autoStart: boolean = false;

    private remainingTime: number = 0;
    private isRunning: boolean = false;
    private defaultLabelColor: Color | null = null;
    private urgentColor: Color = new Color(255, 64, 64, 255);
    private labelOpacity: UIOpacity | null = null;
    private blinkTween: Tween<UIOpacity> | null = null;
    private isInUrgentState: boolean = false;

    protected onEnable(): void {
        if (this.autoStart) {
            this.startCountdown();
        } else {
            this.remainingTime = Math.max(0, this.countdownSeconds);
            this.updateLabel();
            this.setUrgentState(false);
            this.setCountdownTargetsActive(false);
        }
    }

    protected onDisable(): void {
        this.stopCountdown();
        this.setUrgentState(false);
        this.setCountdownTargetsActive(false);
    }

    public startCountdown(duration?: number): void {
        this.remainingTime = Math.max(0, typeof duration === 'number' ? duration : this.countdownSeconds);
        this.isRunning = this.remainingTime > 0;
        this.setUrgentState(false);
        this.setCountdownTargetsActive(false);

        this.updateLabel();
        this.unschedule(this.handleTick);

        if (this.isRunning) {
            this.schedule(this.handleTick, 0.016);
        } else {
            this.finishCountdown();
        }
    }

    public stopCountdown(): void {
        this.unschedule(this.handleTick);
        this.isRunning = false;
        this.setUrgentState(false);
        this.setCountdownTargetsActive(false);
    }

    public holdAtInitialValue(): void {
        this.stopCountdown();
        this.remainingTime = Math.max(0, this.countdownSeconds);
        this.updateLabel();
        this.setUrgentState(false);
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
        this.stopCountdown();
        this.remainingTime = 0;
        this.updateLabel();
        this.setUrgentState(false);
        this.setCountdownTargetsActive(true);
        this.playCompletionAnimations();
        this.node.active = false;
    }

    private updateLabel(): void {
        if (!this.countdownLabel) {
            return;
        }
        this.ensureLabelHelpers();

        const secondsLeft = Math.max(0, Math.ceil(this.remainingTime));
        this.countdownLabel.string = this.formatTime(secondsLeft);
        this.updateUrgentState(secondsLeft);
    }

    private formatTime(totalSeconds: number): string {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = Math.max(0, totalSeconds - minutes * 60);
        return `${this.padTime(minutes)}:${this.padTime(seconds)}`;
    }

    private padTime(value: number): string {
        return value.toString().padStart(2, '0');
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
        if (this.countdownLabel) {
            this.countdownLabel.color = this.urgentColor.clone();
        }
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
        if (!this.additionalEnableNodes) {
            return;
        }
        for (const node of this.additionalEnableNodes) {
            if (!node) {
                continue;
            }
            node.active = active;
        }
    }

    private playCompletionAnimations(): void {
        if (!this.completeAnimations) {
            return;
        }
        for (const anim of this.completeAnimations) {
            if (!anim) {
                continue;
            }
            anim.play();
        }
    }
}
