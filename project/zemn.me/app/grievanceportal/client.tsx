"use client";
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from 'react-hook-form';
import { z } from "zod";

import type { components } from "#root/project/zemn.me/api/api_client.gen";
import { PendingPip } from "#root/project/zemn.me/components/PendingPip/PendingPip.js";
import { requestOIDC, useOIDC } from "#root/project/zemn.me/hook/useOIDC.js";
import { useZemnMeApi } from '#root/project/zemn.me/hook/useZemnMeApi.js';
import { ID_Token } from "#root/ts/oidc/oidc.js";
import { and_then as option_and_then, flatten as option_flatten, None, Option, option_result_transpose, Some, unwrap_or as option_unwrap_or, unwrap_or_else as option_unwrap_or_else } from "#root/ts/option/types.js";
import { queryResult } from "#root/ts/result/react-query/queryResult.js";
import { and_then as result_and_then, or_else as result_or_else, unwrap_or as result_unwrap_or, unwrap_or_else as result_unwrap_or_else, Err } from "#root/ts/result/result.js";

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

const grievanceSchema = z.object({
        name: z.string(),
        description: z.string(),
        priority: z.coerce.number().min(1).max(10),
})

function GrievanceEditor({ Authorization }: GrievanceEditorProps) {
        const $api = useZemnMeApi();
        const queryClient = useQueryClient();
        const grievancesKey = ["get", "/grievances", { headers: { Authorization } }] as const;
       const grievances = option_and_then(
               queryResult($api.useQuery(...grievancesKey)),
               r => result_or_else(
                       r,
                       e => Err((e as object) instanceof Error ? e as Error : new Error(String(e)))
               )
       );

        const create = $api.useMutation("post", "/grievances", {
                onSuccess: () => {
                        void queryClient.invalidateQueries({ queryKey: grievancesKey });
                }
        });
        const del = $api.useMutation("delete", "/grievance/{id}", {
                onSuccess: () => {
                        void queryClient.invalidateQueries({ queryKey: grievancesKey });
                }
        });

        const { register, handleSubmit, reset, formState: { errors } } = useForm<NewGrievance>({
                defaultValues,
                resolver: zodResolver(grievanceSchema)
        });

        return <>
                <form onSubmit={handleSubmit(d => {
                        void create.mutate({
                                headers: { Authorization },
                                body: d
                        })
                        reset();
                })}>
                        <fieldset>
                                <legend>New Grievance</legend>
                                <p><label>Name <input {...register("name")} /></label></p>
                                <p><label>Description <textarea {...register("description")} /></label></p>
                                <p><label>Priority <input type="number" min={1} max={10} {...register("priority", { valueAsNumber: true })} /></label></p>
                                <input type="submit" />
                        </fieldset>
                </form>
                <PendingPip value={Some(grievances)} />
                <ul>
                        {option_unwrap_or(option_and_then(
                                grievances,
                                r => result_unwrap_or(r, []).map((g: Grievance) => (
                                        <li key={g.id}>
                                                <strong>{g.name}</strong> (priority {g.priority})
                                                <p>{g.description}</p>
                                               <button onClick={() => void del.mutate({
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

        return <div>
                <p>{login_button}</p>
                {option_unwrap_or(option_and_then(
                        authTokenOrNothing,
                        token => <GrievanceEditor Authorization={token} />
                ), null)}
        </div>
}
