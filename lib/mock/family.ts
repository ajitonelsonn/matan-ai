import type { CareFeature, CareInsight, FamilyActivity, FamilyMember } from "@/lib/types";
import { images } from "./images";
import { at } from "./clock";

export const familyMembers: FamilyMember[] = [
  { id: "fam-ajito", name: "Ajito", role: "Admin", avatarUrl: images.avatarAjito, presence: "home", lastSeenAt: at(0, 8, 55), lastSeenLocation: "Living Room", isAdmin: true },
  { id: "fam-maria", name: "Maria", role: "Spouse", avatarUrl: images.avatarMaria, presence: "home", lastSeenAt: at(0, 9, 12), lastSeenLocation: "Front Door" },
  { id: "fam-noel", name: "Noel", role: "Son", avatarUrl: images.avatarNoel, presence: "away", lastSeenAt: at(0, 8, 43), lastSeenLocation: "Front Door" },
  { id: "fam-ana", name: "Ana", role: "Daughter", avatarUrl: images.avatarAna, presence: "home", lastSeenAt: at(-1, 20, 15), lastSeenLocation: "Side Door" },
  { id: "fam-grandpa", name: "Grandpa", role: "Family", avatarUrl: images.avatarGrandpa, presence: "home", lastSeenAt: at(0, 7, 21), lastSeenLocation: "Living Room" },
  { id: "fam-grandma", name: "Grandma", role: "Family", avatarUrl: images.avatarGrandma, presence: "home", lastSeenAt: at(0, 7, 40), lastSeenLocation: "Living Room" },
];

export const familyActivity: FamilyActivity[] = [
  { id: "fa-1", memberId: "fam-maria", label: "Maria arrived home", location: "Front Door", timestamp: at(0, 9, 12), icon: "House", tone: "success" },
  { id: "fa-2", memberId: "fam-noel", label: "Noel left for school", location: "Front Door", timestamp: at(0, 8, 43), icon: "Backpack", tone: "primary" },
  { id: "fa-3", memberId: "fam-grandpa", label: "Grandpa in living room", location: "Living Room", timestamp: at(0, 7, 21), icon: "Armchair", tone: "purple" },
  { id: "fa-4", memberId: "fam-grandma", label: "Grandma in living room", location: "Living Room", timestamp: at(0, 7, 40), icon: "Coffee", tone: "purple" },
  { id: "fa-5", memberId: "fam-ana", label: "Ana arrived home", location: "Side Door", timestamp: at(-1, 20, 15), icon: "House", tone: "success" },
  { id: "fa-6", memberId: "fam-noel", label: "Noel arrived home", location: "Front Door", timestamp: at(-1, 15, 45), icon: "House", tone: "success" },
];

export const careInsights: CareInsight[] = [
  { id: "ci-1", title: "Normal Routine", description: "All family members followed their usual schedule today.", tone: "success", icon: "CircleCheck" },
  { id: "ci-2", title: "Good Rest", description: "Everyone was at home during night hours (10 PM - 6 AM).", tone: "purple", icon: "Moon" },
  { id: "ci-3", title: "No Unexpected Activity", description: "No unusual activity detected around family areas.", tone: "warning", icon: "CircleAlert" },
];

export const careFeatures: CareFeature[] = [
  { id: "cf-arrival", label: "Family Arrival Alerts", description: "Get notified when family members arrive home.", enabled: true, icon: "Bell", tone: "warning" },
  { id: "cf-night", label: "Night Time Check-ins", description: "Alert if no movement is detected during sleep hours.", enabled: true, icon: "Moon", tone: "purple" },
  { id: "cf-elderly", label: "Elderly Care Monitoring", description: "Monitor daily activity for elderly family members.", enabled: true, icon: "Activity", tone: "primary" },
  { id: "cf-unusual", label: "Unusual Activity Alerts", description: "Notify on unexpected activity in family areas.", enabled: true, icon: "CircleAlert", tone: "danger" },
];

export const liveFamilyViews = [
  { cameraId: "cam-front", label: "Front Door", imageUrl: images.frontDoor },
  { cameraId: "cam-indoor", label: "Living Room", imageUrl: images.livingRoom },
  { cameraId: "cam-kids", label: "Kids Room", imageUrl: images.kidsRoom },
  { cameraId: "cam-driveway", label: "Driveway", imageUrl: images.driveway },
];
