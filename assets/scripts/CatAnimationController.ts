import { _decorator, Component, Node, SkeletalAnimation } from 'cc';
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

    private animationSpeedMultiplier = 1;
    private currentClip: string | null = null;
    private bedoNodeInitiallyActive = true;

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
        this.setBedoNodeActive(false);
        this.playClip('Run');
    }

    public doBedo (): void {
        this.setBedoNodeActive(false);
        this.playClip('Bedo');
    }

    public doDoing (): void {
        this.setBedoNodeActive(true);
        this.playClip('DapBua');
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
}
