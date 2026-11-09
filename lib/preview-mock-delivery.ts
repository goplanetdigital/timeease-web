import {createHash} from 'node:crypto';
export const MOCK_DELIVERY_CASE='outbox_mock_delivery' as const;
export const MOCK_DELIVERY_ID='a1d26449-c4b5-4668-bffb-746ad257e708';
export const MOCK_DELIVERY_RECIPIENT='mock-inbox@example.invalid';
// Only the explicitly synthetic provider receipt; never a real sender authority.
export function mockReceiptMatches(deliveryId:unknown,messageId:unknown):boolean{
 return typeof deliveryId==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(deliveryId)&&
  typeof messageId==='string'&&messageId===createHash('sha256').update('mock-provider:'+deliveryId).digest('hex');
}
