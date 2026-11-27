/**
 * Matrix 能力探测响应夹具。
 *
 * 字段口径对齐 SDK：`IServerVersions` / `ILoginFlowsResponse`
 * （分别对应 `GET /_matrix/client/v3/versions` 与 `GET /_matrix/client/v3/login`）。
 */

export interface MatrixVersionsResponse {
  versions: string[]
}

export interface MatrixLoginFlowsResponse {
  flows: Array<{ type: string }>
}

export const matrixVersionsResponse: MatrixVersionsResponse = {
  versions: ['v1.17']
}

export const matrixLoginFlowsResponse: MatrixLoginFlowsResponse = {
  flows: [{ type: 'm.login.password' }]
}
