import { _decorator, Component, input, Input } from 'cc';
import { CountdownActivator } from 'db://assets/scripts/CountdownActivator';
const { ccclass } = _decorator;

@ccclass('scene_click')
export class scene_click extends Component {

    start() {
        input.on(Input.EventType.TOUCH_START, this.onClick, this);
    }

    onDestroy() {
        input.off(Input.EventType.TOUCH_START, this.onClick, this);
    }

    private onClick() {
        const activators = this.node.scene?.getComponentsInChildren(CountdownActivator) ?? [];
        for (const activator of activators) {
            if (activator?.tryTriggerStore()) {
                return;
            }
        }
    }
}
