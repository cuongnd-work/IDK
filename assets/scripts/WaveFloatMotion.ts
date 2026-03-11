import { _decorator, Component, Node, Vec3, randomRange } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('WaveFloatMotion')
export class WaveFloatMotion extends Component {
    @property({ tooltip: 'Node that receives the floating motion (defaults to this node).' })
    public targetNode: Node | null = null;

    @property({ tooltip: 'Vertical amplitude of the floating wave.', min: 0 })
    public amplitude = 0.05;

    @property({ tooltip: 'Wave speed in cycles per second.', min: 0 })
    public waveSpeed = 1;

    @property({ tooltip: 'Initial phase offset (radians).' })
    public phaseOffset = 0;

    @property({ tooltip: 'Randomize phase so each popup floats differently.' })
    public randomizePhase = true;

    private basePosition: Vec3 = new Vec3();
    private elapsed = 0;

    protected onLoad(): void {
        this.reinitialize(true);
    }

    protected onEnable(): void {
        this.reinitialize(false);
    }

    protected update(dt: number): void {
        if (!this.targetNode) {
            return;
        }

        this.elapsed += dt;
        const wave = Math.sin(this.elapsed * this.waveSpeed + this.phaseOffset) * this.amplitude;
        const pos = this.targetNode.position;
        this.targetNode.setPosition(pos.x, this.basePosition.y + wave, pos.z);
    }

    public reinitialize(randomizePhaseOverride?: boolean): void {
        this.targetNode = this.targetNode ?? this.node;
        if (!this.targetNode) {
            return;
        }

        const shouldRandomize = typeof randomizePhaseOverride === 'boolean'
            ? randomizePhaseOverride
            : this.randomizePhase;

        if (shouldRandomize && this.randomizePhase) {
            this.phaseOffset = randomRange(0, Math.PI * 2);
        }

        this.cacheBasePosition();
        this.elapsed = 0;
    }

    private cacheBasePosition(): void {
        if (!this.targetNode) {
            return;
        }
        this.basePosition.set(this.targetNode.position);
    }
}
