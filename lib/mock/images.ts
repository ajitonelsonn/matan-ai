/**
 * All remote mock imagery lives here so it can be swapped for real Ring media later.
 * Every consumer must render gracefully if a URL fails (see <SafeImage />).
 */
const u = (id: string, w = 900) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=70`;

export const images = {
  // Cameras / scenes
  frontDoor: u("photo-1600047509807-ba8f99d2cdde"),
  frontDoorNight: u("photo-1513584684374-8bab748fbf90"),
  backDoor: u("photo-1523301343968-6a6ebf63c672"),
  driveway: u("photo-1605276374104-dee2a0ed3cd6"),
  vehicle: u("photo-1502877338535-766e1452684a"),
  sideDoor: u("photo-1585320806297-9794b3e4eeae"),
  indoor: u("photo-1586023492125-27b2c045efd7"),
  livingRoom: u("photo-1555041469-a586c61ea9bc"),
  kidsRoom: u("photo-1616594039964-ae9021a400a0"),
  delivery: u("photo-1595246140625-573b715d11dc"),
  packageAtDoor: u("photo-1595246140625-573b715d11dc"),
  cat: u("photo-1514888286974-6c03e2ca1dba"),
  familyArrival: u("photo-1511895426328-dc8714191300"),
  houseEvening: u("photo-1568605114967-8130f3a36994"),
  houseModern: u("photo-1570129477492-45c003edd2be"),
  houseAutumn: u("photo-1480074568708-e7b720bb3f09"),
  doorbell: u("photo-1600585154340-be6161a56a0c"),
  // Business
  office: u("photo-1497366216548-37526070297c"),
  officeEntrance: u("photo-1497366811353-6870744d04b2"),
  warehouse: u("photo-1553413077-190dd305871c"),
  retail: u("photo-1441986300917-64674bd600d8"),
  remoteSite: u("photo-1524758631624-e2822e304c36"),
  storefront: u("photo-1555529669-e69e7aa0ba9a"),
  // Identity / landscape
  timorLandscape: u("photo-1506905925346-21bda4d32df4", 700),
  coastline: u("photo-1469474968028-56623f02e42e", 700),
  hills: u("photo-1470071459604-3b5ec3a7fe05", 700),
  // Portraits
  avatarAjito: u("photo-1500648767791-00dcc994a43e", 200),
  avatarMaria: u("photo-1494790108377-be9c29b29330", 200),
  avatarNoel: u("photo-1503454537195-1dcabb73ffb9", 200),
  avatarAna: u("photo-1544005313-94ddf0286df2", 200),
  avatarGrandpa: u("photo-1552374196-c4e7ffc6e126", 200),
  avatarGrandma: u("photo-1559839734-2b71ea197ec2", 200),
  avatarSara: u("photo-1573496359142-b8d87734a5a2", 200),
  avatarRui: u("photo-1507003211169-0a1dd7228f2d", 200),
  avatarLia: u("photo-1438761681033-6461ffad8d80", 200),
  avatarTomas: u("photo-1472099645785-5658abf4ff4e", 200),
  avatarElsa: u("photo-1580489944761-15a19d654956", 200),
  avatarJoao: u("photo-1547425260-76bcadfb4f2c", 200),
  avatarFilo: u("photo-1554151228-14d9def656e4", 200),
  avatarPedro: u("photo-1566492031773-4f4e44671857", 200),
  avatarNina: u("photo-1489424731084-a5d8b219a5bb", 200),
  avatarMarco: u("photo-1560250097-0b93528c311a", 200),
  avatarBela: u("photo-1548142813-c348350df52b", 200),
};

export type ImageKey = keyof typeof images;
