export const KUBERNETES_SERIES_SLUG = "kubernetes";

export type KubernetesCourseTrack = "software" | "ai" | "platform";
export type KubernetesCourseRoute = "all" | KubernetesCourseTrack;
export type KubernetesModuleDifficulty =
  | "foundation"
  | "intermediate"
  | "advanced";

export type KubernetesCourseModule = {
  number: number;
  season: 1 | 2 | 3 | 4;
  title: string;
  shortTitle: string;
  summary: string;
  duration: string;
  difficulty: KubernetesModuleDifficulty;
  tracks: readonly KubernetesCourseTrack[];
  slug?: string;
};

export type KubernetesCourseSeason = {
  number: 1 | 2 | 3 | 4;
  title: string;
  range: string;
  thesis: string;
};

const sharedTracks: KubernetesCourseTrack[] = ["software", "ai", "platform"];
const inferenceTracks: KubernetesCourseTrack[] = ["ai", "platform"];

export const kubernetesCourseSeasons: KubernetesCourseSeason[] = [
  {
    number: 1,
    title: "Why the platform exists",
    range: "00–06",
    thesis:
      "Learn the basic words by building from one running program to a small cluster.",
  },
  {
    number: 2,
    title: "How applications actually run",
    range: "07–10",
    thesis:
      "Follow packets, data and scheduling decisions through the cluster.",
  },
  {
    number: 3,
    title: "How applications survive production",
    range: "11–17",
    thesis: "Secure, observe, release and repair a system using evidence.",
  },
  {
    number: 4,
    title: "How inference changes the system",
    range: "18–26",
    thesis:
      "Add model lifecycle, accelerators, batching, topology and nested control loops.",
  },
];

export const kubernetesCourseModules: KubernetesCourseModule[] = [
  {
    number: 0,
    season: 1,
    title: "Orientation and the disposable lab",
    shortTitle: "Where is the cluster, really?",
    summary:
      "Learn what Kubernetes, a cluster, a node, and kubectl mean while building a local cluster you can safely erase.",
    duration: "45 min lab",
    difficulty: "foundation",
    tracks: sharedTracks,
    slug: "kubernetes-00-disposable-lab",
  },
  {
    number: 1,
    season: 1,
    title: "From process to container",
    shortTitle: "A process with boundaries",
    summary:
      "Start with an ordinary running program, package it as a container, connect two services, and stop them safely.",
    duration: "60 min lab",
    difficulty: "foundation",
    tracks: sharedTracks,
    slug: "kubernetes-01-process-to-container",
  },
  {
    number: 2,
    season: 1,
    title: "Why Kubernetes: desired state and feedback loops",
    shortTitle: "Desired state and feedback loops",
    summary:
      "Tell Kubernetes what should be running, watch it notice a difference, and see it repair that difference.",
    duration: "45 min lab",
    difficulty: "foundation",
    tracks: sharedTracks,
  },
  {
    number: 3,
    season: 1,
    title: "The Kubernetes API and kubectl literacy",
    shortTitle: "Read the API before the YAML",
    summary:
      "Ask the cluster what it supports, then read its objects, status messages and event history.",
    duration: "45 min lab",
    difficulty: "foundation",
    tracks: sharedTracks,
  },
  {
    number: 4,
    season: 1,
    title: "Pods and multi-container design",
    shortTitle: "The smallest scheduling unit",
    summary:
      "Learn why some containers share one address, storage and lifetime inside a Pod while others should stay separate.",
    duration: "60 min lab",
    difficulty: "foundation",
    tracks: sharedTracks,
  },
  {
    number: 5,
    season: 1,
    title: "Workload controllers",
    shortTitle: "Who keeps the work alive?",
    summary:
      "Run a service that should stay alive and a task that should finish, then watch Kubernetes repair each one.",
    duration: "60 min lab",
    difficulty: "foundation",
    tracks: sharedTracks,
  },
  {
    number: 6,
    season: 1,
    title: "Configuration, Secrets and workload identity",
    shortTitle: "Change behavior without rebuilding",
    summary:
      "Change settings without rebuilding an image, and give applications credentials without placing them in source code.",
    duration: "45 min lab",
    difficulty: "foundation",
    tracks: sharedTracks,
  },
  {
    number: 7,
    season: 2,
    title: "Service discovery and packet flow",
    shortTitle: "Follow one packet",
    summary:
      "Follow one request from a name to a stable service address and finally to a changing Pod address.",
    duration: "60 min lab",
    difficulty: "intermediate",
    tracks: sharedTracks,
  },
  {
    number: 8,
    season: 2,
    title: "Gateway API and NetworkPolicy",
    shortTitle: "North–south and east–west traffic",
    summary:
      "Let selected traffic enter the cluster, block traffic that should not pass, and test both decisions.",
    duration: "60 min lab",
    difficulty: "intermediate",
    tracks: sharedTracks,
  },
  {
    number: 9,
    season: 2,
    title: "Storage and stateful systems",
    shortTitle: "State outlives a Pod—sometimes",
    summary:
      "Keep data when a Pod is replaced, then separate storage, copies, backups and real recovery.",
    duration: "60 min lab",
    difficulty: "intermediate",
    tracks: sharedTracks,
  },
  {
    number: 10,
    season: 2,
    title: "Resources, scheduling and shared clusters",
    shortTitle: "Why did this Pod land here?",
    summary:
      "Give workloads CPU and memory needs, predict which node can run them, and test the limits of a shared cluster.",
    duration: "60 min lab",
    difficulty: "intermediate",
    tracks: sharedTracks,
  },
  {
    number: 11,
    season: 3,
    title: "Security from image to API",
    shortTitle: "Which boundary stopped the attack?",
    summary:
      "Give each workload only the identity, permissions, network access and container privileges it needs.",
    duration: "75–105 min lab",
    difficulty: "intermediate",
    tracks: sharedTracks,
  },
  {
    number: 12,
    season: 3,
    title: "Observability, SLOs and evidence",
    shortTitle: "Ask the system a falsifiable question",
    summary:
      "Join status, events, logs, measurements and request traces to explain what a user experienced.",
    duration: "2–3 h lab",
    difficulty: "intermediate",
    tracks: sharedTracks,
  },
  {
    number: 13,
    season: 3,
    title: "Packaging, delivery and GitOps",
    shortTitle: "Promote evidence, not mutable state",
    summary:
      "Check one fixed release, then move that exact release from testing toward production.",
    duration: "60 min lab",
    difficulty: "intermediate",
    tracks: sharedTracks,
  },
  {
    number: 14,
    season: 3,
    title: "Reliability, disruption and autoscaling",
    shortTitle: "Choose the loop that should react",
    summary:
      "Keep traffic away from unready work, replace versions safely, survive planned stops and add capacity when needed.",
    duration: "90–120 min lab",
    difficulty: "intermediate",
    tracks: sharedTracks,
  },
  {
    number: 15,
    season: 3,
    title: "Systematic debugging and incident response",
    shortTitle: "Find the layer that stopped progressing",
    summary:
      "Use a repeatable checklist to find where progress stopped, keep a timeline and make the smallest safe repair.",
    duration: "60 min lab",
    difficulty: "intermediate",
    tracks: sharedTracks,
  },
  {
    number: 16,
    season: 3,
    title: "Distributed-application patterns Kubernetes does not provide",
    shortTitle: "Correctness lives above the scheduler",
    summary:
      "Handle duplicate requests, retries, queues, overload and shutdown without losing or repeating important work.",
    duration: "90–120 min lab",
    difficulty: "advanced",
    tracks: sharedTracks,
  },
  {
    number: 17,
    season: 3,
    title: "CRDs, controllers and operators",
    shortTitle: "Build a safe reconcile loop",
    summary:
      "Teach Kubernetes a new kind of object and write a controller that safely keeps it up to date.",
    duration: "90–150 min lab",
    difficulty: "advanced",
    tracks: inferenceTracks,
  },
  {
    number: 18,
    season: 4,
    title: "Inference is a service, not a Pod",
    shortTitle: "Name the inference request path",
    summary:
      "Follow one model request through admission, waiting, generation and streaming, then measure what the user feels.",
    duration: "60 min lab",
    difficulty: "advanced",
    tracks: inferenceTracks,
  },
  {
    number: 19,
    season: 4,
    title: "Model-serving containers and artifacts",
    shortTitle: "A model is a versioned dependency",
    summary:
      "Download and verify a model, warm it up, decide when it is ready, stream a response and stop safely.",
    duration: "60 min lab",
    difficulty: "advanced",
    tracks: inferenceTracks,
  },
  {
    number: 20,
    season: 4,
    title: "Accelerators, topology and scheduling",
    shortTitle: "From device request to placement",
    summary:
      "Show Kubernetes which special devices exist and place model workers where the required capacity is available.",
    duration: "60 min lab",
    difficulty: "advanced",
    tracks: inferenceTracks,
  },
  {
    number: 21,
    season: 4,
    title: "Serving frameworks without logo soup",
    shortTitle: "Choose the owner of each lifecycle",
    summary:
      "Compare common serving tools by the work each one owns, the work you still own and how each one fails.",
    duration: "60 min lab",
    difficulty: "advanced",
    tracks: inferenceTracks,
  },
  {
    number: 22,
    season: 4,
    title: "Batching, KV cache and performance engineering",
    shortTitle: "Measure the latency–throughput frontier",
    summary:
      "Measure the trade-off between response time and total work while changing batches, queues and memory limits.",
    duration: "90–150 min lab",
    difficulty: "advanced",
    tracks: inferenceTracks,
  },
  {
    number: 23,
    season: 4,
    title: "Distributed inference and group scheduling",
    shortTitle: "One replica, several coordinated workers",
    summary:
      "Split one model across several workers and make the group start, update and fail as one service.",
    duration: "60 min lab",
    difficulty: "advanced",
    tracks: inferenceTracks,
  },
  {
    number: 24,
    season: 4,
    title: "Model-aware routing and nested autoscaling",
    shortTitle: "Keep control loops from fighting",
    summary:
      "Send requests to suitable model workers and add or remove capacity without two automatic systems fighting.",
    duration: "2–3 h lab",
    difficulty: "advanced",
    tracks: inferenceTracks,
  },
  {
    number: 25,
    season: 4,
    title: "Inference operations, security and cost",
    shortTitle: "Operate for useful tokens",
    summary:
      "Practise a planned incident across model loading, worker failures, shared users, safe releases and cost.",
    duration: "2–3 h game day",
    difficulty: "advanced",
    tracks: inferenceTracks,
  },
  {
    number: 26,
    season: 4,
    title: "Capstones and the production bridge",
    shortTitle: "Prove the complete system",
    summary:
      "Build and explain a complete software or model-serving system, including what must change beyond a laptop.",
    duration: "20–40 h capstone",
    difficulty: "advanced",
    tracks: sharedTracks,
  },
];

export const kubernetesCourse = {
  title: "Kubernetes from first principles",
  description:
    "A beginner-friendly, lab-first path from one running program to multi-service applications and distributed AI inference.",
  researchDate: "2026-08-15",
  moduleCount: kubernetesCourseModules.length,
  checkpointCount: 8,
};

export function formatModuleNumber(module: number) {
  return String(module).padStart(2, "0");
}

export function getKubernetesModule(module: number) {
  return kubernetesCourseModules.find((entry) => entry.number === module);
}

export function isKubernetesCourseRoute(
  value: string | null
): value is KubernetesCourseRoute {
  return (
    value === "all" ||
    value === "software" ||
    value === "ai" ||
    value === "platform"
  );
}

export function getKubernetesModuleNeighbors(
  module: number,
  route: KubernetesCourseRoute = "all"
) {
  const routeModules =
    route === "all"
      ? kubernetesCourseModules
      : kubernetesCourseModules.filter((entry) => entry.tracks.includes(route));
  const index = routeModules.findIndex((entry) => entry.number === module);

  return {
    previous: index > 0 ? routeModules[index - 1] : undefined,
    next:
      index >= 0 && index < routeModules.length - 1
        ? routeModules[index + 1]
        : undefined,
  };
}
