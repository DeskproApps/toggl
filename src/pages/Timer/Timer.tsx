import {
  useDeskproAppClient,
  useDeskproAppEvents,
  useDeskproAppTheme,
  useDeskproLatestAppContext,
  useInitialisedDeskproAppClient,
  useQueryWithClient,
  Select,
  TwoButtonGroup,
} from "@deskpro/app-sdk";
import {
  AnyIcon,
  Button,
  Checkbox,
  H1,
  H2,
  P8,
  Stack,
  Tag,
  Label,
} from "@deskpro/deskpro-ui";
import {
  faPlus,
  faTimes,
  faMagnifyingGlass,
} from "@fortawesome/free-solid-svg-icons";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  createTimeEntry,
  getCurrentTimeEntry,
  getProjectsByWorkspaceId,
  getTag,
  getTags,
  getTimeEntriesByTicketId,
  stopTimeEntry,
} from "../../api/api";
import { InputWithTitle } from "../../components/InputWithTitle/InputWithTitle";
import { LoadingSpinnerCenter } from "../../components/LoadingSpinnerCenter/LoadingSpinnerCenter";
import { Property, TwoButtonGroupDiv } from "../../styles";
import { colors, dateToHHMMSS } from "../../utils/utils";
import { DateField } from "../../components/DateField/DateField";
import { queryClient } from "../../query";

export const Timer = () => {
  const navigate = useNavigate();
  const { theme } = useDeskproAppTheme();

  const [workspaceId, setWorkspaceId] = useState<string | undefined>(undefined);
  const [page, setPage] = useState<number>(0);
  const [initiallyChecked, setInitiallyChecked] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [subject, setSubject] = useState<string>("");
  const [isBillable, setIsBillable] = useState<boolean>(false);
  const [project, setProject] = useState<string | undefined>(undefined);
  const [timePassedMs, setTimePassedMs] = useState<number | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<string | undefined>(undefined);
  const [endDate, setEndDate] = useState<string | undefined>(undefined);
  const [fetchedCurrent, setFetchedCurrent] = useState<boolean>(false);

  const { client } = useDeskproAppClient();
  const { context } = useDeskproLatestAppContext();

  useInitialisedDeskproAppClient((client) => {
    client.setTitle(`Create Time Entry`);

    client.registerElement("refresh", {
      type: "refresh_button",
    });

    client.registerElement("menuButton", {
      type: "menu",
      items: [
        {
          title: "Logout",
          payload: {
            type: "changePage",
            page: "/",
          },
        },
      ],
    });
  }, []);

  useDeskproAppEvents({
    async onElementEvent(id) {
      switch (id) {
        case "menuButton":
          queryClient.clear();

          client?.setUserState("workspace", "");

          navigate("/login");
      }
    },
  });

  const tagQuery = useQueryWithClient(
    ["tag"],
    (client) =>
      getTag(
        client,
        `deskpro-ticket-${context?.data.ticket.id}`,
        workspaceId as string
      ),
    {
      enabled: !!context?.data.ticket.id || !!workspaceId,
    }
  );

  const currentTimeEntryQuery = useQueryWithClient(
    ["currentTimeEntry"],
    (client) => getCurrentTimeEntry(client)
  );

  const tagsQuery = useQueryWithClient(["tags"], (client) => getTags(client), {
    enabled: !!context?.data.ticket.id,
  });

  const timeEntriesQuery = useQueryWithClient(
    ["getTimeEntriesByTicketId"],
    (client) => getTimeEntriesByTicketId(client, context?.data.ticket.id),
    {
      enabled: !!context?.data.ticket.id,
    }
  );

  const projectsQuery = useQueryWithClient(["projects"], (client) =>
    getProjectsByWorkspaceId(client)
  );

  const toggledEntry = currentTimeEntryQuery.data;

  useInitialisedDeskproAppClient((client) => {
    client.getUserState("workspace").then((state) => {
      setWorkspaceId(state[0].data as string);
    });
  });

  useEffect(() => {
    if (initiallyChecked || !timeEntriesQuery.isSuccess || !toggledEntry)
      return;

    setProject(toggledEntry.project_id);
    setSubject(toggledEntry.description);
    setIsBillable(toggledEntry.billable);
    setTags(toggledEntry.tag_ids);
  }, [initiallyChecked, timeEntriesQuery.isSuccess, toggledEntry]);

  useEffect(() => {
    if (!timeEntriesQuery.data || fetchedCurrent) return;

    const timePassedEntries = timeEntriesQuery.data.reduce((acc, curr) => {
      if (curr.stop === null) return acc;

      return (
        acc + (new Date(curr.stop).getTime() - new Date(curr.start).getTime())
      );
    }, 0);

    const timePassedNow = toggledEntry
      ? new Date().getTime() - new Date(toggledEntry.start ?? 0).getTime()
      : 0;

    setTimePassedMs(timePassedEntries + timePassedNow);

    setFetchedCurrent(true);
  }, [timeEntriesQuery.data, toggledEntry, fetchedCurrent]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!toggledEntry) return;

      setTimePassedMs((prev) => (prev || 0) + 1000);
    }, 1000);

    return () => clearInterval(interval);
  }, [toggledEntry]);

  const usedColorsTags = useMemo(() => {
    return new Array(tags.length)
      .fill(1)
      .map(() => colors[Math.floor(Math.random() * colors?.length)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tags]);

  if (
    !client ||
    !timeEntriesQuery.isSuccess ||
    timePassedMs === null ||
    !projectsQuery.isSuccess
  )
    return <LoadingSpinnerCenter />;

  if (
    !initiallyChecked &&
    currentTimeEntryQuery.data &&
    !currentTimeEntryQuery.data?.tag_ids.includes(tagQuery.data.id)
  ) {
    return (
      <Stack vertical gap={10}>
        <H1>
          There is currently a time entry already running that does not belong
          to this ticket.
          <br />
          In order to continue, the time entry must be stopped.
        </H1>
        <Button
          text="⠀⠀Stop⠀⠀"
          loading={loading}
          onClick={async () => {
            setLoading(true);
            await stopTimeEntry(client, toggledEntry?.id as string).then(() => {
              setInitiallyChecked(true);
            });
            setLoading(false);
          }}
        ></Button>
      </Stack>
    );
  }

  return (
    <Stack vertical gap={10}>
      <Stack style={{ alignSelf: "center", width: "100%" }}>
        <TwoButtonGroupDiv>
          <TwoButtonGroup
            selected={
              {
                0: "one",
                1: "two",
              }[page] as "one" | "two"
            }
            oneIcon={faMagnifyingGlass}
            twoIcon={faPlus}
            oneLabel="Timer"
            twoLabel="Manual"
            oneOnClick={() => !toggledEntry && setPage(0)}
            twoOnClick={() => !toggledEntry && setPage(1)}
          />
        </TwoButtonGroupDiv>
      </Stack>
      <InputWithTitle
        title="Description"
        setValue={setSubject}
        disabled={!!toggledEntry}
        value={subject}
      />
      {projectsQuery.data.length > 0 && (
        <Label label="Project">
          <Select<string>
            onChange={(e) => setProject(e[0])}
            options={projectsQuery.data?.map((e) => ({
              key: e.id,
              label: e.name,
              value: e.id,
              type: "value",
            }))}
            error={!toggledEntry && !project}
            disabled={!!toggledEntry}
            initValue={[]}
          />
        </Label>
      )}
      <Stack vertical style={{ width: "100%" }}>
        <Stack vertical style={{ color: theme.colors.grey80 }} gap={5}>
          <P8 style={{ color: theme?.colors?.grey80 }}>Tags</P8>
          <Stack gap={5} style={{ flexWrap: "wrap" }}>
            {tags
              .filter((e) => e !== tagQuery.data?.id)
              .map((tag, i) => (
                <Tag
                  closeIcon={faTimes as AnyIcon}
                  color={usedColorsTags[i]}
                  onCloseClick={() =>
                    !toggledEntry
                      ? setTags((prev) => prev.filter((e) => e !== tag))
                      : {}
                  }
                  label={tagsQuery.data?.find((e) => e.id === tag)?.name ?? tag}
                  key={i}
                  withClose
                ></Tag>
              ))}
          </Stack>
        </Stack>
        <Stack gap={5} style={{ width: "100%", alignItems: "center" }}>
          <Select<string>
            options={
              tagsQuery.data
                ?.filter((e) => !e.name.startsWith("deskpro-ticket-"))
                .map((e) => ({
                  key: e.id,
                  label: e.name,
                  value: e.id,
                  type: "value",
                })) ?? []
            }
            initValue={[]}
            onChange={(value) => {
              !toggledEntry && setTags(value as string[]);
            }}
          >
            <Button
              text="Add"
              icon={faPlus as AnyIcon}
              minimal
              style={{
                borderBottom: `1px solid ${theme.colors.grey20}`,
              }}
            />
          </Select>
        </Stack>
      </Stack>
      <Stack vertical gap={5}>
        <P8 style={{ color: theme?.colors?.grey80 }}>Billable</P8>
        <Checkbox
          disabled={!!toggledEntry}
          label="Billable"
          checked={isBillable}
          onChange={() => setIsBillable(!isBillable)}
        />
      </Stack>
      {page === 1 && (
        <>
          <DateField
            value={startDate || ""}
            required
            onChange={(e: Date[]) => setStartDate(e[0].toISOString())}
            label="Start Date"
          />
          <DateField
            value={endDate || ""}
            required
            onChange={(e: Date[]) => setEndDate(e[0].toISOString())}
            label="End Date"
          />
        </>
      )}
      <Button
        loading={loading}
        data-testid="change-time-entry"
        text={
          page === 1 ? "⠀⠀Create⠀⠀" : toggledEntry ? "⠀⠀Stop⠀⠀" : "⠀⠀Start⠀⠀"
        }
        onClick={async () => {
          if (toggledEntry) {
            setLoading(true);

            await stopTimeEntry(client, toggledEntry?.id as string).then(() => {
              currentTimeEntryQuery.refetch();
            });

            setLoading(false);

            return;
          }

          if (page === 1 && (!startDate || !endDate)) return;

          setLoading(true);

          await createTimeEntry(
            client,
            {
              start: new Date().toISOString(),
              description: subject,
              tag_ids: [
                tagQuery.data.id,
                ...tags.filter((e) => e !== tagQuery.data.id),
              ],
              ...(project && { projectId: project }),
              billable: isBillable,
              ...(page === 1
                ? {
                    start: startDate,
                    duration: Math.round(
                      (new Date(endDate as string).getTime() -
                        new Date(startDate as string).getTime()) /
                        1000
                    ),
                  }
                : {}),
            },
            context?.data.ticket.id,
            workspaceId as string
          ).then(() => {
            currentTimeEntryQuery.refetch();
          });

          setLoading(false);
        }}
      />
      <div style={{ fontWeight: "bold" }}>
        <Property
          label="Time Elapsed"
          text={<H2>{dateToHHMMSS(timePassedMs).toString()}</H2>}
        />
      </div>
    </Stack>
  );
};
