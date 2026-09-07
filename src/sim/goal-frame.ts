import { pointOnSegment } from './boundaries.ts';
import { contactTime, unitVector, vectorLength } from './math.ts';
import { BALL_CONTROL, FIELD } from './rules.ts';
import type { Vec3 } from './types.ts';

export type FrameContact = {
  type: 'frame';
  timeFraction: number;
  position: Vec3;
  normal: Vec3;
};

/** Posts are vertical cylinders; the crossbar is horizontal. Both use swept contact. */
export function goalFrameContacts(from: Vec3, to: Vec3): FrameContact[] {
  const contacts: FrameContact[] = [];
  const collisionRadius = FIELD.postRadius + BALL_CONTROL.radius;
  const separatedRadius = collisionRadius + BALL_CONTROL.collisionSeparation;
  for (const goalX of [0, FIELD.length]) {
    for (const postY of [
      FIELD.width / 2 - FIELD.goalWidth / 2,
      FIELD.width / 2 + FIELD.goalWidth / 2,
    ]) {
      const timeFraction = contactTime(from, to, { x: goalX, y: postY }, collisionRadius);
      if (timeFraction === null) continue;
      const position = pointOnSegment(from, to, timeFraction);
      if (position.z > FIELD.goalHeight + collisionRadius) continue;
      let direction = unitVector({ x: position.x - goalX, y: position.y - postY });
      if (vectorLength(direction) === 0) direction = { x: goalX === 0 ? 1 : -1, y: 0 };
      contacts.push({
        type: 'frame',
        timeFraction,
        position: {
          x: goalX + direction.x * separatedRadius,
          y: postY + direction.y * separatedRadius,
          z: position.z,
        },
        normal: { ...direction, z: 0 },
      });
    }
    const timeFraction = contactTime(
      { x: from.x, y: from.z },
      { x: to.x, y: to.z },
      { x: goalX, y: FIELD.goalHeight },
      collisionRadius,
    );
    if (timeFraction === null) continue;
    const position = pointOnSegment(from, to, timeFraction);
    if (Math.abs(position.y - FIELD.width / 2) > FIELD.goalWidth / 2) continue;
    let direction = unitVector({ x: position.x - goalX, y: position.z - FIELD.goalHeight });
    if (vectorLength(direction) === 0) direction = { x: goalX === 0 ? 1 : -1, y: 0 };
    contacts.push({
      type: 'frame',
      timeFraction,
      position: {
        x: goalX + direction.x * separatedRadius,
        y: position.y,
        z: FIELD.goalHeight + direction.y * separatedRadius,
      },
      normal: { x: direction.x, y: 0, z: direction.y },
    });
  }
  return contacts;
}
