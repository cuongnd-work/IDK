import { _decorator, Component, Node, Vec3, tween, Tween, UIOpacity, Slider, NodeEventType, Button } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('TusSliderHand')
export class TusSliderHand extends Component {
    @property({ type: Slider, tooltip: 'Slider dung lam trigger an tay.' })
    public sliderTarget: Slider = null;

    @property({ type: Button, tooltip: 'Button kich hoat disable tay (uu tien cao hon slider).' })
    public triggerButton: Button = null;

    @property({ type: Node, tooltip: 'Node ban tay visual.' })
    public handNode: Node = null;

    @property({ type: Vec3, tooltip: 'Offset keo tay (local) tu vi tri ban dau.' })
    public dragOffset: Vec3 = new Vec3(200, 0, 0);

    @property({ tooltip: 'Thoi gian keo tay (giay).' })
    public sweepDuration: number = 0.8;

    @property({ tooltip: 'Thoi gian dung truoc khi lap lai (giay).' })
    public pauseDuration: number = 0.4;

    @property({ tooltip: 'Thoi gian fade-in.' })
    public fadeInDuration: number = 0.2;

    @property({ tooltip: 'Thoi gian fade-out sau khi keo xong.' })
    public fadeOutDuration: number = 0.25;

    @property({ tooltip: 'Cho phep hien lai sau khi nguoi dung cham.' })
    public resumeAfterTouch: boolean = true;

    @property({ tooltip: 'Thoi gian doi truoc khi hien lai (giay).' })
    public resumeDelay: number = 3;

    private startPosition: Vec3 = new Vec3();
    private handInitiallyActive: boolean = true;
    @property({ tooltip: 'Thoi gian giu tay truoc khi keo (giay).' })
    public pressDuration: number = 0.25;

    @property({ tooltip: 'Ty le scale khi nhan tay.' })
    public pressScale: number = 0.9;

    private moveTween: Tween<Node> | null = null;
    private opacityTween: Tween<UIOpacity> | null = null;
    private opacityComp: UIOpacity | null = null;
    private initialOpacity: number = 255;
    private initialScale: Vec3 = new Vec3();
    private pressScaleVec: Vec3 = new Vec3();
    private resumeScheduled: boolean = false;
    private touchNodes: Node[] = [];
    private sliderEventsRegistered: boolean = false;
    private buttonRegistered = false;

    protected onLoad(): void {
        if (!this.handNode) {
            return;
        }
        this.handInitiallyActive = this.handNode.active;
        this.handNode.getPosition(this.startPosition);
        this.handNode.getScale(this.initialScale);
        this.updatePressScaleVec();
        this.opacityComp = this.handNode.getComponent(UIOpacity) ?? this.handNode.addComponent(UIOpacity);
        this.initialOpacity = this.opacityComp.opacity;
    }

    protected onEnable(): void {
        this.registerTouchEvents();
        this.startLoop();
    }

    protected onDisable(): void {
        this.unregisterTouchEvents();
        this.stopLoop();
        this.unscheduleResume();
        if (this.handNode) {
            this.handNode.active = this.handInitiallyActive;
            this.handNode.setPosition(this.startPosition);
        }
        if (this.opacityComp) {
            this.opacityComp.opacity = this.initialOpacity;
        }
    }

    private registerTouchEvents(): void {
        this.touchNodes = [];
        if (this.triggerButton) {
            this.addTouchNode(this.triggerButton.node);
            this.triggerButton.node.on(Button.EventType.CLICK, this.handleButtonClicked, this);
            this.buttonRegistered = true;
        }
        if (this.sliderTarget) {
            this.addTouchNode(this.sliderTarget.node);
            if (this.sliderTarget.handle) {
                this.addTouchNode(this.sliderTarget.handle.node);
            }
            this.sliderTarget.node.on(Slider.EventType.SLIDING, this.handleSliderSliding, this);
            this.sliderTarget.node.on(Slider.EventType.SLIDED, this.handleSliderSlid, this);
            this.sliderEventsRegistered = true;
        }
        for (const node of this.touchNodes) {
            node.on(NodeEventType.TOUCH_START, this.handleTargetTouchStart, this);
            node.on(NodeEventType.TOUCH_END, this.handleTargetTouchEnd, this);
            node.on(NodeEventType.TOUCH_CANCEL, this.handleTargetTouchEnd, this);
        }
    }

    private unregisterTouchEvents(): void {
        for (const node of this.touchNodes) {
            node.off(NodeEventType.TOUCH_START, this.handleTargetTouchStart, this);
            node.off(NodeEventType.TOUCH_END, this.handleTargetTouchEnd, this);
            node.off(NodeEventType.TOUCH_CANCEL, this.handleTargetTouchEnd, this);
        }
        this.touchNodes.length = 0;
        if (this.sliderEventsRegistered && this.sliderTarget) {
            this.sliderTarget.node.off(Slider.EventType.SLIDING, this.handleSliderSliding, this);
            this.sliderTarget.node.off(Slider.EventType.SLIDED, this.handleSliderSlid, this);
            this.sliderEventsRegistered = false;
        }
        if (this.buttonRegistered && this.triggerButton) {
            this.triggerButton.node.off(Button.EventType.CLICK, this.handleButtonClicked, this);
            this.buttonRegistered = false;
        }
    }

    private startLoop(): void {
        if (!this.handNode) {
            return;
        }
        this.stopLoop();
        this.handNode.getScale(this.initialScale);
        this.updatePressScaleVec();
        this.handNode.setPosition(this.startPosition);
        this.handNode.setScale(this.initialScale);
        this.showHand(true);
        if (this.opacityComp) {
            this.opacityComp.opacity = 0;
        }

        const targetPos = new Vec3();
        Vec3.add(targetPos, this.startPosition, this.dragOffset);

        const pressDuration = Math.max(0, this.pressDuration);
        const halfPress = pressDuration * 0.5;
        const pressScaleTarget = new Vec3(this.pressScaleVec.x, this.pressScaleVec.y, this.pressScaleVec.z);
        const initialScaleTarget = new Vec3(this.initialScale.x, this.initialScale.y, this.initialScale.z);

        const cycle = tween()
            .call(() => {
                this.handNode.setPosition(this.startPosition);
                this.handNode.setScale(this.initialScale);
                this.showHand(true);
            });

        if (pressDuration > 0) {
            cycle
                .to(halfPress, { scale: pressScaleTarget }, { easing: 'sineOut' })
                .to(halfPress, { scale: initialScaleTarget }, { easing: 'sineIn' });
        }

        cycle
            .to(this.sweepDuration, { position: targetPos }, { easing: 'sineInOut' })
            .call(() => {
                this.handNode.setPosition(this.startPosition);
            })
            .delay(this.pauseDuration);

        this.moveTween = tween(this.handNode)
            .repeatForever(cycle)
            .start();

        if (this.opacityComp) {
            const fadeHold = Math.max(0, this.sweepDuration + pressDuration - this.fadeInDuration - this.fadeOutDuration);
            this.opacityTween = tween(this.opacityComp)
                .repeatForever(
                    tween()
                        .call(() => {
                            this.opacityComp.opacity = 0;
                        })
                        .to(this.fadeInDuration, { opacity: this.initialOpacity })
                        .delay(fadeHold)
                        .to(this.fadeOutDuration, { opacity: 0 })
                        .delay(this.pauseDuration)
                )
                .start();
        }
    }

    private stopLoop(): void {
        if (this.moveTween) {
            this.moveTween.stop();
            this.moveTween = null;
        }
        if (this.opacityTween) {
            this.opacityTween.stop();
            this.opacityTween = null;
        }
    }

    private showHand(visible: boolean): void {
        if (!this.handNode) {
            return;
        }
        this.handNode.active = visible && this.handInitiallyActive;
    }

    private updatePressScaleVec(): void {
        Vec3.multiplyScalar(this.pressScaleVec, this.initialScale, this.pressScale);
    }

    private addTouchNode(node: Node | null): void {
        if (!node) {
            return;
        }
        if (this.touchNodes.includes(node)) {
            return;
        }
        this.touchNodes.push(node);
    }

    private handleTargetTouchStart(): void {
        this.onTutorialTouchStart();
    }

    private handleTargetTouchEnd(): void {
        this.onTutorialTouchEnd();
    }

    private handleSliderSliding(): void {
        this.onTutorialTouchStart();
    }

    private handleSliderSlid(): void {
        this.onTutorialTouchEnd();
    }

    private handleButtonClicked(): void {
        this.onTutorialTouchStart();
        this.onTutorialTouchEnd();
    }

    private onTutorialTouchStart(): void {
        this.stopLoop();
        this.showHand(false);
        this.unscheduleResume();
    }

    private onTutorialTouchEnd(): void {
        if (!this.resumeAfterTouch) {
            return;
        }
        this.scheduleResume();
    }

    private scheduleResume(): void {
        this.unscheduleResume();
        const delay = Math.max(0, this.resumeDelay);
        this.scheduleOnce(this.resumeTutorial, delay);
        this.resumeScheduled = true;
    }

    private resumeTutorial = (): void => {
        this.resumeScheduled = false;
        this.startLoop();
    };

    private unscheduleResume(): void {
        if (this.resumeScheduled) {
            this.unschedule(this.resumeTutorial);
            this.resumeScheduled = false;
        }
    }
}
