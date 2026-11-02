import type { ActionFunctionArgs } from 'react-router';
import { updateSession } from '#root/project/me/zemn/hook/session.server.js';

export const action = ({ request }: ActionFunctionArgs) =>
	updateSession(request);
export const loader = () => new Response('Method not allowed', { status: 405 });
