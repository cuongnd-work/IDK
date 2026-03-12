import { _decorator, Component, Node } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('DisableNodesOnEnable')
export class DisableNodesOnEnable extends Component {
    @property({ type: [Node], tooltip: 'Danh sach node se bi tat khi component nay enable.' })
    public targets: Node[] = [];

    @property({ tooltip: 'Bat lai cac node khi component bi disable.' })
    public restoreOnDisable: boolean = false;

    protected onEnable(): void {
        this.setTargetsActive(false);
    }

    protected onDisable(): void {
        if (this.restoreOnDisable) {
            this.setTargetsActive(true);
        }
    }

    private setTargetsActive(active: boolean): void {
        if (!this.targets) {
            return;
        }
        for (const node of this.targets) {
            if (!node) {
                continue;
            }
            node.active = active;
        }
    }
}
