import {
  IDeskproClient,
  proxyFetch,
} from "@deskpro/app-sdk";
import { ICreateTimeEntry, ITimeEntry } from "../types/timeEntry";
import { RequestMethod } from "./types";
import { IWorkspace } from "../types/workspace";

export const getTag = async (
  client: IDeskproClient,
  name: string,
  workspaceId: string
) => {
  const tags = await getTags(client);
  const tag = tags?.find((t) => t.name === name);

  if (tag) {
    return tag;
  }

  return createTag(client, name, workspaceId);
};

export const getTagById = async (client: IDeskproClient, id: string) =>
  installedRequest(client, `workspaces/[user[workspace]]/tags/${id}`, "GET");

export const createTag = async (
  client: IDeskproClient,
  name: string,
  workspaceId: string
) =>
  installedRequest(client, "workspaces/[user[workspace]]/tags", "POST", {
    name,
    workspace_id: workspaceId,
  });

export const getWorkspaceById = (
  client: IDeskproClient
): Promise<IWorkspace[]> =>
  installedRequest(client, `workspaces/[user[workspace]]`, "GET");

export const getWorkspaces = (client: IDeskproClient): Promise<IWorkspace[]> =>
  installedRequest(client, `workspaces`, "GET");

export const stopTimeEntry = (
  client: IDeskproClient,
  timeEntryId: string
): Promise<ITimeEntry> =>
  installedRequest(
    client,
    `workspaces/[user[workspace]]/time_entries/${timeEntryId}/stop`,
    "PATCH"
  );

export const getTimeEntriesByTicketId = async (
  client: IDeskproClient,
  ticketId: string
): Promise<ITimeEntry[]> => {
  const [ids] = await client.getState(`time_entries-${ticketId}`);

  if (!ids || !ids.data) {
    return [];
  }

  const arr: ITimeEntry[] = [];

  const erroredIds: string[] = [];

  await Promise.all(
    (ids.data as string[]).map(async (id) => {
      try {
        const res = await getTimeEntry(client, id);

        arr.push(res);
      } catch (e) {
        if ((e as string).includes("429"))
          throw new Error(
            `Too many Requests, please wait until you reuse the app`
          );

        erroredIds.push(id);
      }
    })
  );

  if (erroredIds.length) {
    ids.data = (ids.data as string[]).filter((id) => !erroredIds.includes(id));

    await client.setState(`time_entries-${ticketId}`, ids.data);
  }

  return arr;
};

export const getTimeEntry = (
  client: IDeskproClient,
  id: string
): Promise<ITimeEntry> =>
  installedRequest(client, `me/time_entries/${id}`, "GET");

export const createTimeEntry = async (
  client: IDeskproClient,
  data: ICreateTimeEntry,
  ticketId: string,
  workspaceId: string
) => {
  const res = await installedRequest(
    client,
    "workspaces/[user[workspace]]/time_entries",
    "POST",
    {
      ...data,
      created_with: "Deskpro",
      duration: data.duration || -1,
      start: data.start || new Date().toISOString(),
      workspace_id: workspaceId,
    }
  );

  const [idsState] = await client.getState(`time_entries-${ticketId}`);

  if (idsState?.data) {
    await client.setState(`time_entries-${ticketId}`, [
      ...(idsState.data as string[]),
      res.id,
    ]);
  } else {
    await client.setState(`time_entries-${ticketId}`, [res.id]);
  }
};

export const getCurrentTimeEntry = (
  client: IDeskproClient
): Promise<ITimeEntry> =>
  installedRequest(client, `me/time_entries/current`, "GET");

export const getTags = (
  client: IDeskproClient
): Promise<{ id: string; name: string }[]> =>
  installedRequest(client, "workspaces/[user[workspace]]/tags", "GET");

export const getProjectsByWorkspaceId = (
  client: IDeskproClient
): Promise<{ name: string; id: string }[]> =>
  installedRequest(client, "workspaces/[user[workspace]]/projects", "GET");

export const getTaskByWorkspaceProjectId = (
  client: IDeskproClient,
  projectId: string
) =>
  installedRequest(
    client,
    `workspaces/[user[workspace]]/projects/${projectId}/tasks`,
    "GET"
  );

const installedRequest = async (
  client: IDeskproClient,
  endpoint: string,
  method: RequestMethod,
  data?: unknown
) => {
  const fetch = await proxyFetch(client);

  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Basic [user[api_token]]",
    },
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(
    `https://api.track.toggl.com/api/v9/${endpoint}`,
    options
  );

  if (
    isResponseError(response) ||
    (response.status === 400 && endpoint === "tags")
  ) {
    throw JSON.stringify({
      status: response.status,
      message: await response.text(),
    });
  }

  const json = await response.json();

  if (json?.error) {
    throw new Error(`${json.error} ${json.errorDescription}`);
  }

  return json;
};

export const isResponseError = (response: Response) =>
  response.status < 200 || response.status >= 400;
