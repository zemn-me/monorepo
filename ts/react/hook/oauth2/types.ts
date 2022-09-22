/**
 * @fileoverview types for how oauth2 works. more or less.
 */

export type client_id = string

export const client_type =
    'confidential' | 'public';

export type redirect_uri = URL;

export type Scope<S extends string = string> = S;

export type Scopes<S extends string = string> = Scope<S>[];

export const serializeScopes =
    (s: Scopes) => s.join(",");

export interface Server {
    scopes: Scopes
    code: string
    authorize_uri: URL
}

export interface Client {
    /**
     * Whether the client is confidential or not. The spec whines
     * about how this is really important but most of the
     * time, people don't really care.
     * @see https://datatracker.ietf.org/doc/html/rfc6749#section-2.1
     */
    type?: client_type

    /**
     * The unique identifier of this client.
     */
    id: client_id

    /**
     * A set of possible recievers for oauth grants.
     */
    redirect_uri: redirect_uri[]
}

export const grant_type = 'implicit' | 'code';

export interface AuthorizeRequest<client extends Client = Client, server extends Server = Server> {
    response_type: grant_type
    client_id: client["id"]
    redirect_uri: client["redirect_uri"][number]
    state: string
    scopes: server["scopes"]
}

export interface AuthorizeResponse<
    client extends client = Client,
    server extends Server = Server,
    request extends AuthorizeRequest<client, server>
> {
    code: server["code"]
    state: request["state"]
}

export const error = 'invalid_request' | 'unauthorized_client' | 'access_denied' | 'unsupported_response_type' | 'invalid_scope' | 'server_error' | 'temporarily_unavailable'

export interface ErrorResponse {
    error: error,
    error_description: string,
    error_uri: URL
}
