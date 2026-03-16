import { JiraPageDetector } from "./JiraPageDetector";
import { TaskExtractor } from "./TaskExtractor";
import { FloatingTimer } from "./FloatingTimer";

const taskExtractor = new TaskExtractor();
const floatingTimer = new FloatingTimer();

floatingTimer.mount();

const detector = new JiraPageDetector((taskKey) => {
  if (taskKey === null) {
    floatingTimer.setTaskKey(null, null);
    return;
  }

  const baseUrl = `${window.location.protocol}//${window.location.host}`;
  taskExtractor
    .resolveTaskMeta(taskKey, baseUrl)
    .then((meta) => {
      floatingTimer.setTaskKey(taskKey, meta);
    })
    .catch((err: unknown) => {
      console.error("[TimeRabbit] Failed to resolve task meta:", err);
      floatingTimer.setTaskKey(taskKey, null);
    });
});

detector.start();
