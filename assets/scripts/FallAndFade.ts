import { _decorator, Component, Node, tween, Vec3, UIOpacity, Tween } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('FallAndFade')
export class FallAndFade extends Component {
    @property({ type: Node, tooltip: 'Node se duoc keo xuong.' })
    public moveTarget: Node | null = null;

    @property({ type: Node, tooltip: 'Node dung de fade. De trong se dung moveTarget.' })
    public opacityTarget: Node | null = null;

    @property({ tooltip: 'Khoang cach roi theo truc Y (don vi local). Am de roi xuong.' })
    public fallOffsetY: number = -120;

    @property({ tooltip: 'Thoi gian roi (giay).' })
    public fallDuration: number = 0.6;

    @property({ tooltip: 'Thoi gian fade-in ban dau.' })
    public fadeInDuration: number = 0.15;

    @property({ tooltip: 'Thoi gian fade-out sau khi roi.' })
    public fadeOutDuration: number = 0.25;

    @property({ tooltip: 'Tu dong phat animation moi khi node enable.' })
    public playOnEnable: boolean = true;

    private startPosition: Vec3 = new Vec3();
    private opacityComp: UIOpacity | null = null;
    private initialOpacity: number = 255;
    private moveTween: Tween<Node> | null = null;
    private opacityTween: Tween<UIOpacity> | null = null;
    private resolvedMoveNode: Node | null = null;
    private resolvedOpacityNode: Node | null = null;

    protected onLoad(): void {
        this.resolvedMoveNode = this.moveTarget ?? this.node;
        this.resolvedOpacityNode = this.opacityTarget ?? this.resolvedMoveNode;

        if (this.resolvedMoveNode) {
            this.resolvedMoveNode.getPosition(this.startPosition);
        }

        if (this.resolvedOpacityNode) {
            this.opacityComp = this.resolvedOpacityNode.getComponent(UIOpacity) ?? this.resolvedOpacityNode.addComponent(UIOpacity);
            this.initialOpacity = this.opacityComp.opacity;
        }
    }

    protected onEnable(): void {
        if (this.playOnEnable) {
            this.playAnimation();
        }
    }

    protected start(): void {
        if (!this.playOnEnable) {
            this.playAnimation();
        }
    }

    protected onDisable(): void {
        this.stopTweens();
    }

    public playAnimation(): void {
        if (!this.resolvedMoveNode) {
            return;
        }
        this.stopTweens();
        this.resolvedMoveNode.setPosition(this.startPosition);

        const targetPos = new Vec3(
            this.startPosition.x,
            this.startPosition.y + this.fallOffsetY,
            this.startPosition.z
        );

        this.moveTween = tween(this.resolvedMoveNode)
            .to(this.fallDuration, { position: targetPos }, { easing: 'quadOut' })
            .start();

        this.setupOpacityTween();
    }

    private setupOpacityTween(): void {
        if (!this.opacityComp) {
            return;
        }
        this.opacityComp.opacity = 0;
        this.opacityTween = tween(this.opacityComp);

        if (this.fadeInDuration > 0) {
            this.opacityTween = this.opacityTween.to(this.fadeInDuration, { opacity: this.initialOpacity });
        } else {
            this.opacityComp.opacity = this.initialOpacity;
        }

        const remaining = Math.max(0, this.fallDuration - this.fadeOutDuration);
        if (this.fadeOutDuration > 0) {
            this.opacityTween = this.opacityTween
                .delay(remaining)
                .to(this.fadeOutDuration, { opacity: 0 });
        }

        this.opacityTween.start();
    }

    private stopTweens(): void {
        if (this.moveTween) {
            this.moveTween.stop();
            this.moveTween = null;
        }
        if (this.opacityTween) {
            this.opacityTween.stop();
            this.opacityTween = null;
        }
    }
}
