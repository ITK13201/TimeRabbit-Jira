import type { Message, MessageResponse } from "@/shared/messages";
import type { TimerController } from "./TimerController";
import type { StorageService } from "./StorageService";

export class MessageRouter {
  constructor(
    private readonly timerController: TimerController,
    private readonly storage: StorageService
  ) {}

  register(): void {
    chrome.runtime.onMessage.addListener(
      (message: Message, _sender, sendResponse: (response: MessageResponse) => void) => {
        this._handleMessage(message)
          .then(sendResponse)
          .catch((err: unknown) => {
            const errorMessage = err instanceof Error ? err.message : String(err);
            sendResponse({ type: "ERROR", message: errorMessage });
          });
        // Return true to indicate async response
        return true;
      }
    );
  }

  private async _handleMessage(message: Message): Promise<MessageResponse> {
    switch (message.type) {
      case "START_TIMER": {
        const { taskKey, activityType, meta } = message.payload;
        await this.timerController.startTimer(taskKey, activityType, meta);
        return { type: "OK" };
      }

      case "STOP_TIMER": {
        await this.timerController.stopTimer();
        return { type: "OK" };
      }

      case "SWITCH_ACTIVITY": {
        const { activityType } = message.payload;
        await this.timerController.switchActivity(activityType);
        return { type: "OK" };
      }

      case "DISCARD_TIMER": {
        await this.timerController.discardTimer();
        return { type: "OK" };
      }

      case "GET_STATE": {
        const { activeTimer, meta } = await this.timerController.getState();
        return { type: "STATE", activeTimer, meta };
      }

      case "GET_LOGS": {
        const logs = await this.storage.getLogs();
        const summaries = await this.storage.computeSummaries();
        const metaCache = await this.storage.getAllTaskMeta();
        return { type: "LOGS", logs, summaries, metaCache };
      }

      default: {
        const exhaustiveCheck: never = message;
        return { type: "ERROR", message: `Unknown message type: ${JSON.stringify(exhaustiveCheck)}` };
      }
    }
  }
}
