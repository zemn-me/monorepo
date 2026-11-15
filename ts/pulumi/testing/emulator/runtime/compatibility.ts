/* biome-ignore-all lint/suspicious/noConsole: log integration API progress */
/** Explicit API fixtures for gaps in the pinned emulator; all other requests pass through. */
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { request } from 'node:https';
import { configuration } from './configuration.js';

export async function compatibilityGateway() {
	const config = configuration();
	const ca = await readFile(config.certificate);
	const calls: string[] = [];
	let forwardedRequests = 0;
	const tags = new Map<string, string>();
	const nameservers = new Map<string, unknown>();
	const domainTags = new Map<string, unknown>();
	const operations = new Map<string, string>();
	const lockedDomains = new Set<string>();
	const queryLogs = new Map<string, string>();
	const mountTargetGroups = new Map<string, unknown>();
	const server = createServer(async (incoming, response) => {
		try {
			const chunks: Buffer[] = [];
			for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
			const body = Buffer.concat(chunks);
			const address = server.address();
			if (
				!address ||
				typeof address === 'string' ||
				![
					`127.0.0.1:${address.port}`,
					`000000000000.127.0.0.1:${address.port}`,
				].includes(incoming.headers.host ?? '')
			) {
				response.writeHead(403);
				return response.end(
					'Only the configured emulator endpoint is allowed'
				);
			}
			// Account-prefixed numeric hosts are valid SDK proxy destinations but
			// WHATWG URL rejects them as malformed IPv4. Parse only their path.
			const targetPath = (incoming.url ?? '/').replace(
				/^http:\/\/[^/]+/,
				''
			);
			const url = new URL(targetPath, 'http://localhost');
			console.log(
				`AWS request ${incoming.method} ${url.pathname}${url.search}`
			);
			const action = String(incoming.headers['x-amz-target'] ?? '')
				.split('.')
				.at(-1);
			const json = () =>
				JSON.parse(body.toString()) as Record<string, unknown>;
			const reply = (operation: string, value: unknown) => {
				calls.push(operation);
				response.writeHead(200, {
					'content-type': 'application/x-amz-json-1.1',
				});
				response.end(JSON.stringify(value));
			};
			if (action === 'UpdateCostAllocationTagsStatus') {
				for (const item of json()['CostAllocationTagsStatus'] as {
					TagKey: string;
					Status: string;
				}[])
					tags.set(item.TagKey, item.Status);
				return reply(action, { Errors: [] });
			}
			if (action === 'ListCostAllocationTags')
				return reply(action, {
					CostAllocationTags: [...tags]
						.filter(([key]) => {
							const selected = json()['TagKeys'];
							return (
								!Array.isArray(selected) ||
								selected.includes(key)
							);
						})
						.map(([TagKey, Status]) => ({
							TagKey,
							Status,
							Type: 'UserDefined',
						})),
				});
			if (action === 'UpdateTagsForDomain') {
				const input = json();
				domainTags.set(
					String(input['DomainName']),
					input['TagsToUpdate']
				);
				return reply(action, {});
			}
			if (action === 'ListTagsForDomain')
				return reply(action, {
					TagList: domainTags.get(String(json()['DomainName'])) ?? [],
				});
			if (
				action === 'UpdateDomainNameservers' ||
				action === 'EnableDomainTransferLock'
			) {
				const input = json();
				if (action === 'UpdateDomainNameservers')
					nameservers.set(
						String(input['DomainName']),
						input['Nameservers']
					);
				const OperationId = randomUUID();
				operations.set(
					OperationId,
					action === 'UpdateDomainNameservers'
						? 'UPDATE_NAMESERVER'
						: 'ENABLE_DOMAIN_TRANSFER_LOCK'
				);
				if (action === 'EnableDomainTransferLock')
					lockedDomains.add(String(input['DomainName']));
				return reply(action, { OperationId });
			}
			if (
				action === 'GetOperationDetail' &&
				operations.has(String(json()['OperationId']))
			)
				return reply(action, {
					OperationId: json()['OperationId'],
					Status: 'SUCCESSFUL',
					Type: operations.get(String(json()['OperationId'])),
					SubmittedDate: Date.now() / 1000,
				});
			if (incoming.headers['x-emulator-fixture'] === 'OCI.Publish')
				calls.push('OCI.Publish');
			if (
				incoming.method === 'GET' &&
				url.pathname.startsWith('/v20180820/tags/')
			) {
				calls.push('S3Control.ListTagsForResource');
				response.writeHead(200, { 'content-type': 'text/xml' });
				return response.end(
					'<ListTagsForResourceResult xmlns="http://awss3control.amazonaws.com/doc/2018-08-20/"><Tags/></ListTagsForResourceResult>'
				);
			}
			if (
				url.pathname === '/2013-04-01/queryloggingconfig' &&
				incoming.method === 'POST'
			) {
				const id = randomUUID();
				const xml = `<QueryLoggingConfig><Id>${id}</Id>${body
					.toString()
					.replace(/<\?xml[^>]*\?>/g, '')
					.replace(
						/<\/?CreateQueryLoggingConfigRequest[^>]*>/g,
						''
					)}</QueryLoggingConfig>`;
				queryLogs.set(id, xml);
				calls.push('Route53.CreateQueryLoggingConfig');
				response.writeHead(201, {
					'content-type': 'text/xml',
					location: `${url.pathname}/${id}`,
				});
				return response.end(
					`<CreateQueryLoggingConfigResponse xmlns="https://route53.amazonaws.com/doc/2013-04-01/">${xml}</CreateQueryLoggingConfigResponse>`
				);
			}
			const queryLog = queryLogs.get(
				url.pathname.split('/').at(-1) ?? ''
			);
			if (queryLog && incoming.method === 'GET') {
				calls.push('Route53.GetQueryLoggingConfig');
				response.writeHead(200, { 'content-type': 'text/xml' });
				return response.end(
					`<GetQueryLoggingConfigResponse xmlns="https://route53.amazonaws.com/doc/2013-04-01/">${queryLog}</GetQueryLoggingConfigResponse>`
				);
			}
			const mountTarget =
				/^\/2015-02-01\/mount-targets\/([^/]+)\/security-groups$/.exec(
					url.pathname
				);
			if (
				mountTarget &&
				incoming.method === 'GET' &&
				mountTargetGroups.has(mountTarget[1] ?? '')
			)
				return reply('EFS.DescribeMountTargetSecurityGroups', {
					SecurityGroups: mountTargetGroups.get(mountTarget[1] ?? ''),
				});
			const query = new URLSearchParams(body.toString());
			const defaultEgress =
				query.get('Action') === 'RevokeSecurityGroupEgress' &&
				query.get('IpPermissions.1.IpProtocol') === '-1' &&
				query.get('IpPermissions.1.IpRanges.1.CidrIp') ===
					'0.0.0.0/0' &&
				!query.has('IpPermissions.2.IpProtocol') &&
				!query.has('IpPermissions.1.IpRanges.2.CidrIp');
			const defaultAuthorize =
				query.get('Action') === 'AuthorizeSecurityGroupEgress' &&
				query.get('IpPermissions.1.IpProtocol') === '-1' &&
				query.get('IpPermissions.1.IpRanges.1.CidrIp') ===
					'0.0.0.0/0' &&
				!query.has('IpPermissions.2.IpProtocol') &&
				!query.has('IpPermissions.1.IpRanges.2.CidrIp');
			forwardedRequests++;
			const upstream = request(
				new URL(url.pathname + url.search, config.endpoint),
				{ method: incoming.method, headers: incoming.headers, ca },
				forwarded => {
					const parts: Buffer[] = [];
					forwarded.on('data', chunk =>
						parts.push(Buffer.from(chunk))
					);
					forwarded.on('end', () => {
						let result = Buffer.concat(parts);
						if ((forwarded.statusCode ?? 0) >= 400)
							console.log(
								`AWS response ${forwarded.statusCode} ${incoming.method} ${url.pathname}${url.search}: ${result.toString().slice(0, 500)}`
							);
						if (
							defaultAuthorize &&
							forwarded.statusCode === 400 &&
							result.includes('InvalidPermission.Duplicate')
						) {
							calls.push('EC2.AuthorizeExistingDefaultEgress');
							response.writeHead(200, {
								'content-type': 'text/xml',
							});
							return response.end(
								'<AuthorizeSecurityGroupEgressResponse xmlns="http://ec2.amazonaws.com/doc/2016-11-15/"><return>true</return></AuthorizeSecurityGroupEgressResponse>'
							);
						}
						if (
							defaultEgress &&
							forwarded.statusCode === 400 &&
							result.includes('InvalidPermission.NotFound')
						) {
							calls.push('EC2.RevokeDefaultEgress');
							response.writeHead(200, {
								'content-type': 'text/xml',
							});
							return response.end(
								'<RevokeSecurityGroupEgressResponse xmlns="http://ec2.amazonaws.com/doc/2016-11-15/"><return>true</return></RevokeSecurityGroupEgressResponse>'
							);
						}
						if (
							url.pathname === '/2015-02-01/mount-targets' &&
							incoming.method === 'POST' &&
							forwarded.statusCode === 200
						) {
							const target = JSON.parse(result.toString()) as {
								MountTargetId: string;
							};
							mountTargetGroups.set(
								target.MountTargetId,
								json()['SecurityGroups'] ?? []
							);
						}
						if (
							action === 'GetDomainDetail' &&
							forwarded.statusCode === 200
						) {
							const detail = JSON.parse(
								result.toString()
							) as Record<string, unknown>;
							const value = nameservers.get(
								String(json()['DomainName'])
							);
							if (value) detail['Nameservers'] = value;
							if (lockedDomains.has(String(json()['DomainName'])))
								detail['StatusList'] = [
									'clientTransferProhibited',
								];
							result = Buffer.from(JSON.stringify(detail));
						}
						delete forwarded.headers['transfer-encoding'];
						response.writeHead(forwarded.statusCode ?? 502, {
							...forwarded.headers,
							'content-length': result.length,
						});
						response.end(result);
					});
				}
			);
			upstream.on('error', error => {
				response.writeHead(502);
				response.end(String(error));
			});
			upstream.end(body);
		} catch (error) {
			response.writeHead(500);
			response.end(String(error));
		}
	});
	await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
	server.unref();
	const address = server.address();
	if (!address || typeof address === 'string')
		throw new Error('No gateway port');
	return {
		endpoint: `http://127.0.0.1:${address.port}`,
		calls,
		get forwardedRequests() {
			return forwardedRequests;
		},
		close: () => {
			server.closeAllConnections();
			server.close();
		},
	};
}
