import assert from "node:assert/strict";
import { test } from "node:test";
import { createSourceLoader } from "./helpers/source-loader.mjs";

test("handoff candidates exclude the source, inactive/locked accounts and non-management roles", () => {
  const { getHandoffCandidates, isAvailableAccount } = createSourceLoader()(
    "features/users/lifecycle.ts",
  );
  const user = { id: 1, role: "ADMIN", isActive: true, isLocked: false };
  const users = [
    user,
    { ...user, id: 2, role: "MANAGER" },
    { ...user, id: 3 },
    { ...user, id: 4, role: "IT_STAFF" },
    { ...user, id: 5, role: "EMPLOYEE" },
    { ...user, id: 6, isLocked: true },
    { ...user, id: 7, isActive: false },
  ];
  assert.deepEqual(
    getHandoffCandidates(users, 1).map((item) => item.id),
    [2, 3],
  );
  assert.equal(isAvailableAccount(users[5]), false);
  assert.equal(isAvailableAccount(users[6]), false);
});

test("the last usable ADMIN check ignores locked and inactive ADMINs", () => {
  const { isLastUsableAdmin } = createSourceLoader()(
    "features/users/lifecycle.ts",
  );
  const admin = { id: 1, role: "ADMIN", isActive: true, isLocked: false };
  assert.equal(
    isLastUsableAdmin(admin, [admin, { ...admin, id: 2, isLocked: true }]),
    true,
  );
  assert.equal(
    isLastUsableAdmin(admin, [admin, { ...admin, id: 2, isActive: false }]),
    true,
  );
  assert.equal(isLastUsableAdmin(admin, [admin, { ...admin, id: 2 }]), false);
  assert.equal(
    isLastUsableAdmin({ ...admin, role: "EMPLOYEE" }, [admin]),
    false,
  );
});

test("handoff errors retain blocker counts and preserve unknown server errors", () => {
  const { translateLifecycleMessage } = createSourceLoader()(
    "features/users/lifecycle.ts",
  );
  assert.match(
    translateLifecycleMessage(
      "Cannot deactivate user: 2 active tickets, 3 assigned assets, 4 pending approvals, 5 active subordinates require handoff.",
    ),
    /2 ticket.*3 tài sản.*4 đơn nghỉ.*5 nhân viên/,
  );
  assert.match(
    translateLifecycleMessage(
      "Replacement cannot approve their own leave request",
    ),
    /không được tự duyệt/,
  );
  assert.match(
    translateLifecycleMessage("Handoff would create a reporting cycle"),
    /vòng lặp/,
  );
  assert.equal(
    translateLifecycleMessage("Unexpected server message"),
    "Unexpected server message",
  );
});

test("handoff API uses the backend endpoint and unwraps its actual counts", async () => {
  const calls = [];
  const expected = {
    userId: 2,
    replacementId: 3,
    reportsTransferred: 4,
    approvalsTransferred: 5,
  };
  const load = createSourceLoader({
    "@/lib/axios": {
      api: {
        patch: async (...args) => {
          calls.push(args);
          return { data: { data: expected } };
        },
      },
    },
  });
  const { handoffUserApi } = load("features/users/api.ts");
  assert.deepEqual(await handoffUserApi(2, { replacementId: 3 }), expected);
  assert.deepEqual(calls, [["/users/2/handoff", { replacementId: 3 }]]);
});

test("lifecycle mutations refresh affected caches on success and failure without optimistic handoff", async () => {
  const invalidated = [];
  const load = createSourceLoader({
    "@tanstack/react-query": {
      useMutation: (options) => options,
      useQueryClient: () => ({
        invalidateQueries: async ({ queryKey }) => {
          invalidated.push(queryKey);
        },
      }),
    },
    "@/features/auth/hooks": { authQueryKeys: { me: ["auth", "me"] } },
    "./api": {
      handoffUserApi: async (id, input) => ({ userId: id, ...input }),
    },
  });
  const hooks = load("features/users/hooks.ts");
  for (const name of [
    "useHandoffUser",
    "useUpdateUser",
    "useChangeUserStatus",
    "useChangeAccountLock",
  ]) {
    const mutation = hooks[name]();
    assert.equal(mutation.onMutate, undefined);
    for (const error of [null, new Error("Conflict")]) {
      invalidated.length = 0;
      await mutation.onSettled(undefined, error);
      assert.deepEqual(invalidated, [
        ["users"],
        ["auth", "me"],
        ["leave-requests"],
        ["tickets"],
        ["assets"],
        ["dashboard"],
      ]);
    }
  }
  assert.deepEqual(
    await hooks
      .useHandoffUser()
      .mutationFn({ id: 2, input: { replacementId: 3 } }),
    { userId: 2, replacementId: 3 },
  );
});

test("handoff form requires explicit selection and confirmation, blocks duplicate submit and stale recipients", async () => {
  const state = [];
  let cursor = 0;
  const Select = () => null;
  const calls = [];
  const load = createSourceLoader({
    react: {
      useState: (initial) => {
        const slot = cursor++;
        if (!(slot in state)) state[slot] = initial;
        return [
          state[slot],
          (value) => {
            state[slot] = value;
          },
        ];
      },
    },
    "next/link": () => null,
    "@/components/ui/button": { Button: () => null },
    "@/components/ui/label": { Label: () => null },
    "@/components/ui/select": {
      Select,
      SelectContent: () => null,
      SelectItem: () => null,
      SelectTrigger: () => null,
      SelectValue: () => null,
    },
  });
  const { UserHandoffForm } = load(
    "features/users/components/user-handoff-form.tsx",
  );
  const source = {
    id: 2,
    name: "Source",
    role: "MANAGER",
    isActive: true,
    isLocked: false,
  };
  const target = { ...source, id: 3, name: "Target" };
  let props = {
    user: source,
    users: [source, target],
    isSubmitting: false,
    error: null,
    onSubmit: async (id) => {
      calls.push(id);
    },
    onCancel() {},
  };
  const render = () => {
    cursor = 0;
    return UserHandoffForm(props);
  };
  const nodes = (element) =>
    !element || typeof element !== "object"
      ? []
      : [element, ...[element.props?.children].flat(Infinity).flatMap(nodes)];
  const submit = async () => render().props.onSubmit({ preventDefault() {} });
  await submit();
  assert.deepEqual(calls, []);
  nodes(render())
    .find((node) => node.type === Select)
    .props.onValueChange("3");
  await submit();
  assert.deepEqual(calls, []);
  nodes(render())
    .find((node) => node.type === "input")
    .props.onChange({ target: { checked: true } });
  props = { ...props, isSubmitting: true };
  await submit();
  assert.deepEqual(calls, []);
  props = {
    ...props,
    isSubmitting: false,
    users: [source, { ...target, isLocked: true }],
  };
  await submit();
  assert.deepEqual(calls, []);
  props = { ...props, users: [source, target] };
  await submit();
  assert.deepEqual(calls, [3]);
  nodes(render())
    .find((node) => node.type === Select)
    .props.onValueChange("3");
  await submit();
  assert.deepEqual(
    calls,
    [3],
    "changing selection requires fresh confirmation",
  );
});
