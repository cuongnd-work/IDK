import { _decorator, Component, Node, Vec3, tween, Tween } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('FloatingMotion')
export class FloatingMotion extends Component {
    @property({ tooltip: 'Vertical distance (world units).' })
    public amplitude = 10;

    @property({ tooltip: 'Seconds spent traveling in one direction.' })
    public duration = 1.5;

    private origin = new Vec3();
    private lifted = new Vec3();
    private motion: Tween<Node> | null = null;

    protected onLoad(): void {
        this.rebuildTargets();
    }

    protected onEnable(): void {
        this.startFloating();
    }

    protected onDisable(): void {
        this.stopFloating();
        this.node.setPosition(this.origin);
    }

    private rebuildTargets(): void {
        this.node.getPosition(this.origin);
        this.lifted.set(this.origin);
        this.lifted.y += this.amplitude;
    }

    private startFloating(): void {
        this.stopFloating();
        this.rebuildTargets();

        const travelTime = Math.max(this.duration, 0.01);
        this.motion = tween(this.node)
            .repeatForever(
                tween<Node>()
                    .to(travelTime, { position: this.lifted }, { easing: 'smooth' })
                    .to(travelTime, { position: this.origin }, { easing: 'smooth' })
            )
            .start();
    }

    private stopFloating(): void {
        if (this.motion) {
            this.motion.stop();
            this.motion = null;
        }
    }
}
