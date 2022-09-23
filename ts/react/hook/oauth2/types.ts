/**
 * @fileoverview types for how oauth2 works. more or less.
 */

export interface Server {
    scopes: string[]
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
    type?: 'confidential' | 'public'

    /**
     * The unique identifier of this client.
     */
    id: string

    /**
     * A set of possible recievers for oauth grants.
     */
    redirect_uri: string[]
}

export const serializeScopes =
    (s: Server["scopes"]) => s.join(",");

export const grant_type = 'implicit' | 'code';

export interface AuthorizeRequest {
    response_type: 'implicit' | 'code'
    client_id: Client["id"]
    redirect_uri: Client["redirect_uri"][number]
    state: string
    scopes: Server["scopes"]
}

export interface AuthorizeResponse {
    code: Server["code"]
    state: AuthorizeRequest["state"]
}

export const error = 'invalid_request' | 'unauthorized_client' | 'access_denied' | 'unsupported_response_type' | 'invalid_scope' | 'server_error' | 'temporarily_unavailable'

export interface ErrorResponse {
    error: error,
    error_description: string,
    error_uri: URL
}
