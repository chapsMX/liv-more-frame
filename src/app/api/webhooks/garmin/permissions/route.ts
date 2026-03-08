import { NextRequest, NextResponse } from "next/server";

type PermissionChangeItem = {
  userId: string;
  permissionType: string;
  permission: string;
};

type PermissionsPayload = {
  userPermissionsChange?: PermissionChangeItem[];
};

export async function POST(req: NextRequest) {
  let body: PermissionsPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const list = body.userPermissionsChange ?? [];
  if (list.length > 0) {
    console.log("[webhooks/garmin/permissions]", JSON.stringify(body));
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
