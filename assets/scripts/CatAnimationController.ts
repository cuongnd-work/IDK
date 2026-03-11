import { _decorator, Component, Node, SkeletalAnimation } from 'cc';
import { OrderPopup } from 'db://assets/scripts/OrderPopup';
const { ccclass, property } = _decorator;

@ccclass('CatAnimationController')
export class CatAnimationController extends Component {
    @property(SkeletalAnimation)
    private animation: SkeletalAnimation = null!;

    @property(OrderPopup)
    public orderPopup: OrderPopup = null;

    private animationSpeedMultiplier = 1;
    private currentClip: string | null = null;

    protected onLoad (): void {
        this.resolveOrderPopup();
    }

    public sellTargetPopup: OrderPopup | null = null;

    private resolveOrderPopup (): OrderPopup | null {
        if (!this.orderPopup) {
            this.orderPopup = this.getComponentInChildren(OrderPopup);
        }

        return this.orderPopup;
    }

    public doIdle (): void {
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

        this.playClip('Run');
    }

    public doBedo (): void {
        this.playClip('Bedo');
    }

    public doDoing (): void {
        this.playClip('DapBua');
    }

    public setAnimationSpeedMultiplier (multiplier: number): void {
        const clamped = Math.max(0.01, multiplier);
        this.animationSpeedMultiplier = clamped;
        this.applySpeedToClip();
    }

    private playClip (clipName: string): void {
        if (!this.animation) {
            return;
        }

        this.currentClip = clipName;
        this.animation.play(clipName);
        this.applySpeedToClip(clipName);
    }

    private applySpeedToClip (clipName?: string): void {
        if (!this.animation) {
            return;
        }

        const targetClip = clipName ?? this.currentClip;
        if (!targetClip) {
            return;
        }

        const state = this.animation.getState(targetClip);
        if (state) {
            state.speed = this.animationSpeedMultiplier;
        }
    }
}


