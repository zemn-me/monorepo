"use client";
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from 'react-hook-form';
import { z } from "zod";

import type { components } from "#root/project/zemn.me/api/api_client.gen";
import { PendingPip } from "#root/project/zemn.me/components/PendingPip/PendingPip.js";
import { requestOIDC, useOIDC } from "#root/project/zemn.me/hook/useOIDC.js";
import { useDeleteGrievances, useGetGrievances, usePostGrievances } from '#root/project/zemn.me/hook/useZemnMeApi.js';
import { ID_Token } from "#root/ts/oidc/oidc.js";
import { and_then as option_and_then, flatten as option_flatten, None, Option, option_result_transpose, Some, unwrap_or as option_unwrap_or, unwrap_or_else as option_unwrap_or_else } from "#root/ts/option/types.js";
import { Date as PrettyDate } from "#root/ts/react/lang/date.js";
import { queryResult } from "#root/ts/result/react-query/queryResult.js";
import { and_then as result_and_then, Err, or_else as result_or_else, unwrap_or as result_unwrap_or, unwrap_or_else as result_unwrap_or_else } from "#root/ts/result/result.js";

import style from './style.module.css';

interface GrievanceEditorProps {
        readonly Authorization: string
}

type Grievance = components["schemas"]["Grievance"];
type NewGrievance = components["schemas"]["NewGrievance"];

const defaultValues: NewGrievance = {
        name: "",
        description: "",
        priority: 1,
}

const severityMap = new Map<number, string>([
        [1, "Just logging a vibe check \uD83D\uDE0C"],
        [2, "A nice hug will sort it \uD83E\uDD17"],
        [3, "Chai latte & a smile, please \u2615\uFE0F"],
        [4, "Ruffles required \uD83E\uDD54"],
        [5, "Let\u2019s go for a walk by the river \uD83C\uDF05"],
        [6, "Need penguin videos & cuddles \uD83D\uDC27"],
        [7, "Bring snacks and patience \uD83C\uDF71"],
        [8, "Steak dinner peace offering \uD83E\uDD69"],
        [9, "Send me flowers! \uD83D\uDC90"],
        [10, "Flowers + apology letter! \uD83D\uDCDD\uD83D\uDC90"],
]);

const grievanceSchema = z.object({
        name: z.string(),
        description: z.string(),
        priority: z.coerce.number().min(1).max(10),
})


/**
 * a noop that runs a promise in the background
 */
function backgroundPromise<A extends unknown[]>(f: (...a: A) => Promise<void>): (...a: A) => void {
	return (...a: A) => void f(...a)
}

function GrievanceEditor({ Authorization }: GrievanceEditorProps) {
	const create = usePostGrievances();
	const del = useDeleteGrievances();
	const grievances = option_and_then(
		queryResult(useGetGrievances()),
		r => result_or_else(
			r,
			e => Err((e as object) instanceof Error ? e as Error : new Error(String(e)))
		)
	);

	const { register, handleSubmit, reset } = useForm<NewGrievance>({
		defaultValues,
		resolver: zodResolver(grievanceSchema)
	});

	return <>
		<form className={style.formField} onSubmit={backgroundPromise(handleSubmit(d => {
			void create.mutate({
				headers: { Authorization },
				body: d
			})
			reset();
		}))}>
			<fieldset>
				<legend>New Grievance</legend>
				<p className={style.formField}><label>Name <input {...register("name")} /></label></p>
				<p className={style.formField}><label>Description <textarea {...register("description")} /></label></p>
				<p className={style.formField}><label>Priority
					<select {...register("priority", { valueAsNumber: true })}>
						{Array.from(severityMap.entries()).map(([level, caption]) => (
							<option key={level} value={level}>{caption}</option>
						))}
					</select>
				</label></p>
				<input className={style.submitButton} type="submit" />
			</fieldset>
		</form>
		<PendingPip value={Some(grievances)} />
		<ul className={style.grievanceList}>
			{option_unwrap_or(option_and_then(
				grievances,
				r => result_unwrap_or(r, [])
					.slice()
					.sort((a, b) => new Date(b.created).valueOf() - new Date(a.created).valueOf())
					.map((g: Grievance) => (
						<li key={g.id}>
							<strong>{g.name}</strong>
							{" ("}{severityMap.get(g.priority) ?? `level ${g.priority}`}{")"}
							<p><PrettyDate date={new Date(g.created)} /> {new Date(g.created).toLocaleTimeString()}</p>
							<pre>{g.description}</pre>
							<button className={style.deleteButton} onClick={() => void del.mutate({
								params: { path: { id: g.id! } },
								headers: { Authorization }
							})}>Delete</button>
						</li>
					))
			), null)}
		</ul>
	</>
}

export default function GrievancePortal() {
        const googleAuth = useOIDC((v): v is ID_Token => v.iss == "https://accounts.google.com");
        const authToken = option_and_then(
                googleAuth,
                q => result_and_then(
                        q,
                        v => v[0] === undefined ? None : Some(v[0])
                )
        );

        const at = result_and_then(option_result_transpose(authToken),
                o => option_flatten(o)
        );

        const [openWindowHnd, setOpenWindowHnd] = useState<Option<WindowProxy>>(None);

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

        const login_button = result_unwrap_or_else(
                result_and_then(
                        at,
                        r => option_unwrap_or_else(
                                option_and_then(
                                        r,
                                        () => <p>You are logged in.</p>
                                ),
                                () => <button onClick={() => setOpenWindowHnd(Some(requestOIDC("https://accounts.google.com")!))}>Login with Google</button>
                        )
                ), e => <>error: {e}</>);

        const authTokenOrNothing = option_flatten(result_unwrap_or(result_and_then(
                at,
                v => Some(v)
        ), None));

        return <div className={style.wrapper}>
                <h1 className={style.header}>💖 Grievance Portal 💖</h1>
                <p className={style.hearts}>we can fix it!</p>
                <p>{login_button}</p>
                {option_unwrap_or(option_and_then(
                        authTokenOrNothing,
                        token => <GrievanceEditor Authorization={token} />
                ), null)}
        </div>
}
