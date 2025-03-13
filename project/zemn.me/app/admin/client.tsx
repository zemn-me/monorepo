"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import createClient from "openapi-fetch";
import { useCallback, useEffect, useState } from "react";

import { requestOIDC, useOIDC } from "#root/project/zemn.me/app/hook/useOIDC.js";
import Link from "#root/project/zemn.me/components/Link/index.js";
import { ID_Token } from "#root/ts/oidc/oidc.js";
import { and_then as option_and_then, flatten, is_none, None, Option, option_result_transpose, Some, unwrap_or as option_unwrap_or, unwrap_or_else as option_unwrap_or_else, unwrap_unchecked as option_unwrap_unchecked } from "#root/ts/option/types.js";
import type { components, paths } from "#root/ts/pulumi/zemn.me/api/api_client.gen";
import { and_then as result_and_then, is_err, unwrap_err_unchecked, unwrap_or as result_unwrap_or, unwrap_or_else as result_unwrap_or_else, unwrap_unchecked as result_unwrap_unchecked } from "#root/ts/result_types.js";

const apiClient = createClient<paths>({
	baseUrl: "https://api.zemn.me",
})


interface AuthorizerListEditorProps {
	readonly Authorization: string
}

function AuthorizerListEditor({ Authorization }: AuthorizerListEditorProps) {
	const authorizersQueryKey = ['authorizers'];
	const queryClient = useQueryClient();
	const remoteAuthorizers = useQuery({
		queryKey: authorizersQueryKey,
		queryFn: () => apiClient.GET('/callbox/authorizers', {
			headers: {
				Authorization
			}
		})
	});

	interface ItemState {
		/**
		 * The item's value.
		 */
		value: string
		/**
		 * Whether to delete it when submitted.
		 */
		keep: boolean
	}

	const changeRemoteAuthorizers = useMutation({
		mutationFn: (o: components["schemas"]["PhoneNumberPatchRequest"]) => apiClient.PATCH(
			'/callbox/authorizers', {
				body: o,
				headers: {
					Authorization,
				}
		}
		),
		onMutate: () => queryClient.invalidateQueries({
			queryKey: authorizersQueryKey
		})
	});



	const [localAuthorizers, setLocalAuthorizers] = useState<ItemState[]>([]);

	const submitRemoteAuthorizers = useCallback(
		() => {
			const base = new Set(remoteAuthorizers.data?.data ?? []);
			const final = new Set(localAuthorizers.filter(v => v.keep).map(
				v => v.value
			));
			const adds = final.difference(base);
			const removes = base.difference(adds);

			changeRemoteAuthorizers.mutate({
				add: [...adds],
				remove: [...removes]
			});
		}
	, [remoteAuthorizers.data?.data, localAuthorizers, changeRemoteAuthorizers]);

	// if we get new data from the remote, update local state.
	useEffect(
		() => {
			if (remoteAuthorizers.data?.data === undefined) return;

			setLocalAuthorizers(
				remoteAuthorizers.data.data.map(
					value => ({value, keep: true})
				)
			)
		}
	, [remoteAuthorizers.data?.data]);

	const maybeError = remoteAuthorizers.error
		? Some(remoteAuthorizers.error)
		: remoteAuthorizers.data?.error
			? Some(new Error(remoteAuthorizers.data.error.cause))
			: None



	const stateIcon = new Set([
		...remoteAuthorizers.isLoading ? ['⌛'] : [],
		...changeRemoteAuthorizers.isPending ? ['⌛'] : [],
		...remoteAuthorizers.isError ? ['❌'] : [],
		...changeRemoteAuthorizers.isError ? ['❌'] : [],
	]);

	return <form>
		<fieldset>
			<legend>Authorizers</legend>
			<p>These people can accept calls to allow entry.</p>
			<ul>
			{
				localAuthorizers.map(
					(a, i) => <li key={i}>
						<input checked={
							a.keep
						} onChange={
							e =>
								setLocalAuthorizers(v => {
									const clone = [...v];
									clone[i] = {
										...clone[i] ?? { value: "" },
										keep: e.target.checked
									}

									return clone;
								})
						} type="checkbox" />
						<input onChange={
								e => setLocalAuthorizers(v => {
									const clone = [...v];
									clone[i] = {
										...clone[i] ?? { keep: true},
										value: e.target.value
									}

									return clone;
								})
							} type="text"
							value={a.value}
						/>
					</li>
				)
			}
			</ul>
			<button onClick={
				() => setLocalAuthorizers(
					v => [
						...v,
						{value: "", keep: false}
					]
				)
			}>
				Add another authorizer
			</button>
			{
				option_unwrap_or(option_and_then(
					maybeError,
					v => <details>
						<summary>Something went wrong...</summary>
						{v.toString()}
					</details>
				), null)
			}
			<button disabled={
				remoteAuthorizers.isLoading || changeRemoteAuthorizers.isPending
				} onClick={
					() => submitRemoteAuthorizers()
			}>Change authorizers {[...stateIcon].join(" ")}</button>
		</fieldset>
	</form>

}


export default function Admin() {
	const googleAuth = useOIDC((v): v is ID_Token => v.iss == "https://accounts.google.com");
	const authToken = option_and_then(
		googleAuth,
		q => result_and_then(
			q,
			v => v[0] === undefined ? None : Some(v[0])
		)
	);

	const at = result_and_then(option_result_transpose(authToken),
		o => flatten(o)
	);

	const [openWindowHnd, setOpenWindowHnd] = useState<Option<WindowProxy>>(None);

	// when googleAuth is something, make sure to close any open window handles
	useEffect(
		() => void result_and_then(
			at,
			r => option_and_then(
				r,
				() => option_and_then(
					openWindowHnd,
					wnd => wnd.close()
				)
			)
		)
		, [at])

	const authTokenCacheKey = result_unwrap_or(result_and_then(
		at,
		o => option_unwrap_or(option_and_then(
			o,
			o => o
		), undefined)
	), undefined);

	const phoneNumber = useQuery({
		queryKey: ['callbox', 'phone number', authTokenCacheKey],
		queryFn: async () => {
			if (is_err(at)) return <>
				⚠ {unwrap_err_unchecked(at)}
			</>;

			const auth = result_unwrap_unchecked(at);

			if (is_none(auth)) return <>
				You need to log in to see this.
			</>;

			const { phoneNumber } = await apiClient.GET("/phone/number", {
				headers: {
					Authorization: option_unwrap_unchecked(auth)
				}
			}).then(v => v.data!);

			const pnn = phoneNumber;

			return <>
				Callbox phone number is currently: {" "}
				<Link href={`tel:${pnn}`}>{pnn}</Link>
			</>
		}
	});

	const login_button = result_unwrap_or_else(
		result_and_then(
			at,
			r => option_unwrap_or_else(
				option_and_then(
					r,
					() => <p>You are logged in.</p>
				),
				() => <button onClick={() => setOpenWindowHnd(Some(requestOIDC("https://accounts.google.com")!))}>
					<p>
						You are not authenticated to perform this operation.
					</p>
					<p>
						Please click here to authenticate.
					</p>
				</button>)
		), e => <>error: {e}</>);

	const authTokenOrNothing = flatten(result_unwrap_or(result_and_then(
		at,
		v => Some(v)
	), None));

	return <>
		<p>{login_button}</p>
		{phoneNumber.error !== null ? <p>
			{phoneNumber.error.toString()}
		</p> : null}
		{phoneNumber.data !== undefined ? <p>
			{phoneNumber.data}
		</p> : null}
		{option_unwrap_or(option_and_then(
			authTokenOrNothing,
			token => <AuthorizerListEditor Authorization={token}/>
		), null)}
	</>
}
