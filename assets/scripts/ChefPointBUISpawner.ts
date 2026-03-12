import { _decorator, Component, Prefab, Node, instantiate, Vec3, Camera, Canvas, Layers } from 'cc';
import { ChefBehavior } from 'db://assets/scripts/ChefBehavior';

const { ccclass, property } = _decorator;

@ccclass('ChefPointBUISpawner')
export class ChefPointBUISpawner extends Component {
    @property({ type: ChefBehavior, tooltip: 'Chef can lang nghe su kien den diem B.' })
    public chef: ChefBehavior = null;

    @property({ type: Prefab, tooltip: 'UI prefab se spawn tren Canvas.' })
    public uiPrefab: Prefab = null;

    @property({ type: Node, tooltip: 'Parent UI (Canvas) de them node moi vao.' })
    public uiParent: Node = null;

    @property({ type: Camera, tooltip: 'Camera 3D de chuyen point B sang toa do man hinh.' })
    public worldCamera: Camera = null;

    @property({ type: Camera, tooltip: 'Camera UI cua Canvas.' })
    public uiCamera: Camera = null;

    @property({ type: Vec3, tooltip: 'Offset UI sau khi duoc chuyen sang Canvas.' })
    public uiOffset: Vec3 = new Vec3();

    private _worldPos = new Vec3();
    private _screenPos = new Vec3();
    private _uiWorldPos = new Vec3();
    private _cachedWorldCam: Camera | null = null;
    private _cachedUICam: Camera | null = null;

    protected onLoad(): void {
        if (this.chef) {
            this.chef.registerPointBListener(this.handlePointBReached, this);
        }
    }

    protected onDestroy(): void {
        if (this.chef) {
            this.chef.unregisterPointBListener(this.handlePointBReached, this);
        }
    }

    public handlePointBReached(chef?: ChefBehavior): void {
        const targetChef = chef ?? this.chef;
        if (!targetChef) {
            return;
        }
        if (!this.uiPrefab || !this.uiParent) {
            return;
        }

        const pointB = targetChef.pointB ?? targetChef.node;
        if (!pointB) {
            return;
        }

        const worldCam = this.resolveWorldCamera();
        const uiCam = this.resolveUICamera();
        if (!worldCam || !uiCam) {
            return;
        }

        pointB.getWorldPosition(this._worldPos);
        worldCam.worldToScreen(this._worldPos, this._screenPos);

        const spawned = instantiate(this.uiPrefab);
        this.uiParent.addChild(spawned);

        uiCam.screenToWorld(this._screenPos, this._uiWorldPos);
        if (this.uiOffset) {
            Vec3.add(this._uiWorldPos, this._uiWorldPos, this.uiOffset);
        }
        spawned.setWorldPosition(this._uiWorldPos);
    }

    private resolveWorldCamera(): Camera | null {
        if (this.worldCamera && this.worldCamera.node && this.worldCamera.node.isValid) {
            this._cachedWorldCam = this.worldCamera;
            return this.worldCamera;
        }
        if (this._cachedWorldCam && this._cachedWorldCam.node && this._cachedWorldCam.node.isValid) {
            return this._cachedWorldCam;
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
            this._cachedWorldCam = cam;
            return cam;
        }

        return null;
    }

    private resolveUICamera(): Camera | null {
        if (this.uiCamera && this.uiCamera.node && this.uiCamera.node.isValid) {
            this._cachedUICam = this.uiCamera;
            return this.uiCamera;
        }
        if (this._cachedUICam && this._cachedUICam.node && this._cachedUICam.node.isValid) {
            return this._cachedUICam;
        }

        if (this.uiParent) {
            const canvas = this.uiParent.getComponent(Canvas);
            if (canvas && canvas.cameraComponent) {
                this._cachedUICam = canvas.cameraComponent;
                return canvas.cameraComponent;
            }
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
                this._cachedUICam = cam;
                return cam;
            }
        }

        return null;
    }
}
