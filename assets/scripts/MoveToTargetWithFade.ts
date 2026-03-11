import { _decorator, Component, Node, Vec3, UIOpacity, tween, Tween } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('MoveToTargetWithFade')
export class MoveToTargetWithFade extends Component {
    @property(Node)
    public target: Node = null;

    @property({ tooltip: 'Thời gian di chuyển (giây).' })
    public duration: number = 0.5;

    @property({ tooltip: 'Tự chạy khi bật node.' })
    public playOnEnable: boolean = true;

    @property({ tooltip: 'Độ mờ bắt đầu.' })
    public startOpacity: number = 0;

    @property({ tooltip: 'Độ mờ kết thúc.' })
    public endOpacity: number = 255;

    @property({ tooltip: 'Tên easing dùng cho tween vị trí.' })
    public moveEasing: string = 'quadOut';

    @property({ tooltip: 'Tên easing dùng cho tween opacity.' })
    public fadeEasing: string = 'quadOut';

    private cachedOpacity: UIOpacity | null = null;
    private moveTween: Tween<Vec3> | null = null;
    private fadeTween: Tween<UIOpacity> | null = null;

    protected onLoad(): void {
        this.cachedOpacity = this.node.getComponent(UIOpacity) ?? this.node.addComponent(UIOpacity);
    }

    protected onEnable(): void {
        if (this.playOnEnable) {
            this.play();
        }
    }

    protected onDisable(): void {
        this.stopTweens();
    }

    public play(): void {
        if (!this.target) {
            return;
        }

        const startPos = new Vec3();
        this.node.getWorldPosition(startPos);

        const endPos = new Vec3();
        this.target.getWorldPosition(endPos);

        this.stopTweens();

        const animatedPos = startPos.clone();
        this.moveTween = tween(animatedPos)
            .to(this.duration, { x: endPos.x, y: endPos.y, z: endPos.z }, {
                easing: this.moveEasing,
                onUpdate: () => {
                    this.node.setWorldPosition(animatedPos);
                }
            })
            .start();

        if (this.cachedOpacity) {
            this.cachedOpacity.opacity = this.clampOpacity(this.startOpacity);
            this.fadeTween = tween(this.cachedOpacity)
                .to(this.duration, { opacity: this.clampOpacity(this.endOpacity) }, { easing: this.fadeEasing })
                .start();
        }
    }

    private stopTweens(): void {
        if (this.moveTween) {
            this.moveTween.stop();
            this.moveTween = null;
        }

        if (this.fadeTween) {
            this.fadeTween.stop();
            this.fadeTween = null;
        }
    }

    private clampOpacity(value: number): number {
        if (!Number.isFinite(value)) {
            return 0;
        }
        return Math.max(0, Math.min(255, Math.round(value)));
    }
}
