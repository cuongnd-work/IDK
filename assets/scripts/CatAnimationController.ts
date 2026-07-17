import { _decorator, AudioClip, AudioSource, Component, instantiate, Node, Prefab, SkeletalAnimation, Vec3 } from 'cc';
import { OrderPopup } from 'db://assets/scripts/OrderPopup';
const { ccclass, property } = _decorator;

@ccclass('CatAnimationController')
export class CatAnimationController extends Component {
    @property(SkeletalAnimation)
    private animation: SkeletalAnimation = null!;

    @property(OrderPopup)
    public orderPopup: OrderPopup = null;

    @property({ type: Node, tooltip: 'Node se bi tat khi dang Bedo va bat lai voi cac trang thai khac.' })
    public bedoToggleNode: Node = null;

    @property(AudioSource)
    public hammerAudioSource: AudioSource = null;

    @property(AudioClip)
    public hammerSound: AudioClip = null;

    @property({ tooltip: 'Do tre truoc tieng bua dau tien sau khi vao anim DapBua.', min: 0 })
    public hammerSoundInitialDelay = 0.2;

    @property({ tooltip: 'Khoang cach giua moi tieng bua khi anim DapBua dang chay.', min: 0.01 })
    public hammerSoundInterval = 0.8;

    @property({ tooltip: 'Volume tieng bua.', min: 0 })
    public hammerSoundVolume = 1;

    @property(Prefab)
    public hammerVfxPrefab: Prefab = null;

    @property(Node)
    public hammerVfxSpawnPoint: Node = null;

    @property(Node)
    public hammerVfxParent: Node = null;

    @property({ type: Vec3 })
    public hammerVfxOffset: Vec3 = new Vec3();

    @property({ tooltip: 'Thoi gian ton tai cua VFX moi lan dap bua.', min: 0.01 })
    public hammerVfxLifetime = 1;

    @property({ tooltip: 'Ti le thoi gian anim DapBua de spawn VFX.', min: 0, max: 1 })
    public hammerVfxSpawnRatio = 1 / 2;

    private animationSpeedMultiplier = 1;
    private currentClip: string | null = null;
    private bedoNodeInitiallyActive = true;
    private hammerEffectActive = false;
    private lastHammerVfxIteration = -1;
    private readonly hammerVfxWorldPosition = new Vec3();

    protected onLoad (): void {
        this.resolveAnimation();
        this.resolveOrderPopup();
        if (this.bedoToggleNode) {
            this.bedoNodeInitiallyActive = this.bedoToggleNode.active;
        }
    }

    public sellTargetPopup: OrderPopup | null = null;

    private resolveOrderPopup (): OrderPopup | null {
        if (!this.orderPopup) {
            this.orderPopup = this.getComponentInChildren(OrderPopup);
        }

        return this.orderPopup;
    }

    private resolveAnimation (): SkeletalAnimation | null {
        if (!this.animation) {
            this.animation = this.getComponentInChildren(SkeletalAnimation);
        }

        return this.animation;
    }

    public doIdle (): void {
        this.stopHammerEffectLoop();
        this.setBedoNodeActive(false);
        this.playClip('Idle');
    }

    public doWalk (): void {
        // const popup = this.resolveOrderPopup();
        // if (popup) {
        //     popup.sell();
        // }

        if (this.sellTargetPopup){
            this.sellTargetPopup.sell();
        }

        this.doRun();
    }

    public doRun (): void {
        this.stopHammerEffectLoop();
        this.setBedoNodeActive(false);
        this.playClip('Run');
    }

    public doBedo (): void {
        this.stopHammerEffectLoop();
        this.setBedoNodeActive(false);
        this.playClip('Bedo');
    }

    public doDoing (): void {
        this.setBedoNodeActive(true);
        if (this.currentClip !== 'DapBua') {
            this.playClip('DapBua');
            this.startHammerEffectLoop();
            return;
        }

        this.applySpeedToClip('DapBua');
        if (!this.hammerEffectActive) {
            this.startHammerEffectLoop();
        }
    }

    protected onDisable (): void {
        this.stopHammerEffectLoop();
    }

    protected onDestroy (): void {
        this.stopHammerEffectLoop();
    }

    protected update (): void {
        this.trySpawnHammerVfxAtAnimationRatio();
    }

    public setAnimationSpeedMultiplier (multiplier: number): void {
        const clamped = Math.max(0.01, multiplier);
        this.animationSpeedMultiplier = clamped;
        this.applySpeedToClip();
    }

    private playClip (clipName: string): void {
        const animation = this.resolveAnimation();
        if (!animation) {
            return;
        }

        this.currentClip = clipName;
        animation.play(clipName);
        this.applySpeedToClip(clipName);
    }

    private applySpeedToClip (clipName?: string): void {
        const animation = this.resolveAnimation();
        if (!animation) {
            return;
        }

        const targetClip = clipName ?? this.currentClip;
        if (!targetClip) {
            return;
        }

        const state = animation.getState(targetClip);
        if (state) {
            state.speed = this.animationSpeedMultiplier;
        }
    }

    private setBedoNodeActive(enable: boolean): void {
        if (!this.bedoToggleNode) {
            return;
        }
        const shouldBeActive = enable && this.bedoNodeInitiallyActive;
        if (this.bedoToggleNode.active === shouldBeActive) {
            return;
        }
        this.bedoToggleNode.active = shouldBeActive;
    }

    private startHammerEffectLoop (): void {
        if ((!this.hammerAudioSource || !this.hammerSound) && !this.hammerVfxPrefab) {
            return;
        }

        this.stopHammerEffectLoop();
        this.hammerEffectActive = true;

        if (this.hammerAudioSource && this.hammerSound) {
            this.scheduleOnce(this.playHammerSoundTick, this.getScaledHammerSoundDelay(this.hammerSoundInitialDelay));
        }
    }

    private stopHammerEffectLoop (): void {
        this.hammerEffectActive = false;
        this.lastHammerVfxIteration = -1;
        this.unschedule(this.playHammerSoundTick);
    }

    private playHammerSoundTick = (): void => {
        if (!this.hammerEffectActive || this.currentClip !== 'DapBua') {
            return;
        }

        this.hammerAudioSource?.playOneShot(this.hammerSound, Math.max(0, this.hammerSoundVolume));
        this.scheduleOnce(this.playHammerSoundTick, this.getScaledHammerSoundDelay(this.hammerSoundInterval, 0.01));
    };

    private trySpawnHammerVfxAtAnimationRatio (): void {
        if (!this.hammerEffectActive || this.currentClip !== 'DapBua' || !this.hammerVfxPrefab) {
            return;
        }

        const state = this.resolveAnimation()?.getState('DapBua');
        if (!state || state.duration <= 0) {
            return;
        }

        const ratio = state.current / state.duration;
        if (ratio < this.hammerVfxSpawnRatio) {
            return;
        }

        const iteration = Math.floor(Math.max(0, state.time) / state.duration);
        if (iteration === this.lastHammerVfxIteration) {
            return;
        }

        this.lastHammerVfxIteration = iteration;
        this.spawnHammerVfx();
    }

    private getScaledHammerSoundDelay (duration: number, min = 0): number {
        const speed = Math.max(0.01, this.animationSpeedMultiplier);
        return Math.max(min, Math.max(0, duration) / speed);
    }

    private spawnHammerVfx (): void {
        if (!this.hammerVfxPrefab) {
            return;
        }

        const spawned = instantiate(this.hammerVfxPrefab);
        const parent = this.hammerVfxParent ?? this.node.scene ?? this.node.parent;
        if (parent) {
            spawned.parent = parent;
        }

        const spawnPoint = this.hammerVfxSpawnPoint ?? this.node;
        spawnPoint.getWorldPosition(this.hammerVfxWorldPosition);
        this.hammerVfxWorldPosition.add(this.hammerVfxOffset);
        spawned.setWorldPosition(this.hammerVfxWorldPosition);

        this.scheduleOnce(() => {
            if (spawned.isValid) {
                spawned.destroy();
            }
        }, Math.max(0.01, this.hammerVfxLifetime));
    }
}
