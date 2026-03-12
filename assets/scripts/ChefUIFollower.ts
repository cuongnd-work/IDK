import { _decorator, Component, Node, Vec3, Camera, Canvas, Layers } from 'cc';
import { ChefBehavior } from 'db://assets/scripts/ChefBehavior';

const { ccclass, property } = _decorator;

@ccclass('ChefUIFollower')
export class ChefUIFollower extends Component {
    @property({ type: ChefBehavior, tooltip: 'Chef 3D component to follow. Optional when targetNode is assigned.' })
    public chefTarget: ChefBehavior = null;

    @property({ type: Node, tooltip: 'Optional override target (for example, a bone under the chef).' })
    public targetNode: Node = null;

    @property({ type: Camera, tooltip: '3D camera that renders the chefs. Leave empty to auto-detect.' })
    public worldCamera: Camera = null;

    @property({ type: Camera, tooltip: 'UI camera for the Canvas. Leave empty to auto-detect.' })
    public uiCamera: Camera = null;

    @property({ type: Vec3, tooltip: 'World space offset applied before projecting into the UI.' })
    public worldOffset: Vec3 = new Vec3(0, 1.2, 0);

    @property({ type: Vec3, tooltip: 'UI space offset after projection (same units as the Canvas).' })
    public uiOffset: Vec3 = new Vec3();

    @property({ type: Node, tooltip: 'UI Flow node (child) that should toggle with the chef hamburger. Leave empty to use the first child.' })
    public flowNode: Node = null;

    @property({ tooltip: 'Disable the flow node when the chef hamburger is inactive.' })
    public syncFlowWithHamburger: boolean = true;

    @property({ tooltip: 'Automatically toggle this follower node when the target is invisible/unavailable.' })
    public autoHide: boolean = true;

    @property({ tooltip: 'Hide the UI if the target is behind the world camera.' })
    public hideWhenBehindCamera: boolean = true;

    private _worldPos = new Vec3();
    private _screenPos = new Vec3();
    private _uiWorldPos = new Vec3();
    private _initiallyActive = true;
    private _flowNodeInitialActive = true;
    private _cachedCanvas: Canvas | null = null;
    private _cachedWorldCamera: Camera | null = null;
    private _cachedUICamera: Camera | null = null;
    private _cachedChef: ChefBehavior | null = null;

    protected onLoad(): void {
        this._initiallyActive = this.node.active;
        const flow = this.getFlowNode();
        if (flow) {
            this._flowNodeInitialActive = flow.active;
        }
    }

    protected onEnable(): void {
        this.forceRefresh();
    }

    update(): void {
        this.followTarget();
        this.syncFlowNodeVisibility();
    }

    public forceRefresh(): void {
        this.followTarget();
        this.syncFlowNodeVisibility();
    }

    private followTarget(): void {
        const target = this.getTargetNode();
        const worldCamera = this.resolveWorldCamera();
        const uiCamera = this.resolveUICamera();

        if (!target || !worldCamera || !uiCamera) {
            this.applyAutoVisibility(false);
            return;
        }

        target.getWorldPosition(this._worldPos);
        if (this.worldOffset) {
            Vec3.add(this._worldPos, this._worldPos, this.worldOffset);
        }

        worldCamera.worldToScreen(this._worldPos, this._screenPos);
        if (this.hideWhenBehindCamera && this._screenPos.z <= 0) {
            this.applyAutoVisibility(false);
            return;
        }

        uiCamera.screenToWorld(this._screenPos, this._uiWorldPos);
        if (this.uiOffset) {
            Vec3.add(this._uiWorldPos, this._uiWorldPos, this.uiOffset);
        }
        this.node.setWorldPosition(this._uiWorldPos);
        this.applyAutoVisibility(true);
    }

    private getTargetNode(): Node | null {
        if (this.targetNode && this.targetNode.isValid) {
            return this.targetNode;
        }
        if (this.chefTarget && this.chefTarget.node && this.chefTarget.node.isValid) {
            return this.chefTarget.node;
        }
        return null;
    }

    private resolveWorldCamera(): Camera | null {
        if (this.worldCamera && this.worldCamera.node && this.worldCamera.node.isValid) {
            this._cachedWorldCamera = this.worldCamera;
            return this.worldCamera;
        }
        if (this._cachedWorldCamera && this._cachedWorldCamera.node && this._cachedWorldCamera.node.isValid) {
            return this._cachedWorldCamera;
        }

        const scene = this.node.scene;
        if (!scene) {
            return null;
        }

        const uiCam = this.resolveUICamera();
        const cameras = scene.getComponentsInChildren(Camera);
        for (const cam of cameras) {
            if (!cam.enabled || !cam.node.activeInHierarchy) {
                continue;
            }
            if (cam === uiCam) {
                continue;
            }
            if ((cam.visibility & Layers.BitMask.UI_2D) !== 0) {
                continue;
            }
            this._cachedWorldCamera = cam;
            return cam;
        }

        return null;
    }

    private resolveUICamera(): Camera | null {
        if (this.uiCamera && this.uiCamera.node && this.uiCamera.node.isValid) {
            this._cachedUICamera = this.uiCamera;
            return this.uiCamera;
        }
        if (this._cachedUICamera && this._cachedUICamera.node && this._cachedUICamera.node.isValid) {
            return this._cachedUICamera;
        }

        const canvas = this.getCanvas();
        if (canvas && canvas.cameraComponent) {
            this._cachedUICamera = canvas.cameraComponent;
            return canvas.cameraComponent;
        }

        const scene = this.node.scene;
        if (!scene) {
            return null;
        }

        const cameras = scene.getComponentsInChildren(Camera);
        for (const cam of cameras) {
            if (!cam.enabled || !cam.node.activeInHierarchy) {
                continue;
            }
            if ((cam.visibility & Layers.BitMask.UI_2D) !== 0) {
                this._cachedUICamera = cam;
                return cam;
            }
        }

        return null;
    }

    private getCanvas(): Canvas | null {
        if (this._cachedCanvas && this._cachedCanvas.isValid) {
            return this._cachedCanvas;
        }

        const scene = this.node.scene;
        if (!scene) {
            return null;
        }

        const canvas = scene.getComponentInChildren(Canvas);
        this._cachedCanvas = canvas ?? null;
        return canvas ?? null;
    }

    private applyAutoVisibility(visible: boolean): void {
        if (!this.autoHide) {
            return;
        }
        const finalState = visible && this._initiallyActive;
        if (this.node.active === finalState) {
            return;
        }
        this.node.active = finalState;
    }

    private syncFlowNodeVisibility(): void {
        const flow = this.getFlowNode();
        if (!flow) {
            return;
        }
        if (!this.syncFlowWithHamburger) {
            return;
        }
        const chef = this.resolveChefTarget();
        if (!chef || !chef.hamburger) {
            return;
        }
        const shouldShow = this._flowNodeInitialActive && chef.hamburger.activeInHierarchy;
        if (flow.active === shouldShow) {
            return;
        }
        flow.active = shouldShow;
    }

    private getFlowNode(): Node | null {
        if (this.flowNode && this.flowNode.isValid) {
            return this.flowNode;
        }
        if (this.node.children.length > 0) {
            return this.node.children[0];
        }
        return null;
    }

    private resolveChefTarget(): ChefBehavior | null {
        if (this.chefTarget && this.chefTarget.node && this.chefTarget.node.isValid) {
            this._cachedChef = this.chefTarget;
            return this.chefTarget;
        }
        if (this._cachedChef && this._cachedChef.node && this._cachedChef.node.isValid) {
            return this._cachedChef;
        }

        const candidates: (Node | null)[] = [
            this.targetNode,
            this.node,
            this.node ? this.node.parent : null,
        ];

        for (const candidate of candidates) {
            let current = candidate;
            while (current) {
                const chef = current.getComponent(ChefBehavior);
                if (chef) {
                    this._cachedChef = chef;
                    return chef;
                }
                current = current.parent;
            }
        }

        return null;
    }
}
