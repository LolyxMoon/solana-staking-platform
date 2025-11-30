import { NextRequest, NextResponse } from "next/server";

// In-memory storage (must match the array in ../route.ts)
// In production, this would be a database
let pools: any[] = [];

// Import the pools array from parent route (workaround for in-memory storage)
// In production, you'd query a database instead
function getPoolsArray() {
  // This is a temporary solution - in production use a real database
  if (typeof global !== 'undefined' && !(global as any).pools) {
    (global as any).pools = [];
  }
  return (global as any).pools as any[];
}

// GET /api/admin/pools/[id] - Get single pool
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const pools = getPoolsArray();
    const pool = pools.find((p) => p.id === params.id);
    
    if (!pool) {
      return NextResponse.json(
        { error: "Pool not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json(pool);
  } catch (error) {
    console.error("Error fetching pool:", error);
    return NextResponse.json(
      { error: "Failed to fetch pool" },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/pools/[id] - Update pool
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const pools = getPoolsArray();
    const body = await request.json();
    
    const poolIndex = pools.findIndex((p) => p.id === params.id);
    
    if (poolIndex === -1) {
      return NextResponse.json(
        { error: "Pool not found" },
        { status: 404 }
      );
    }
    
    // Update pool
    pools[poolIndex] = {
      ...pools[poolIndex],
      ...body,
      updatedAt: new Date().toISOString(),
    };
    
    console.log("✅ Pool updated:", pools[poolIndex].name);
    return NextResponse.json(pools[poolIndex]);
  } catch (error) {
    console.error("Error updating pool:", error);
    return NextResponse.json(
      { error: "Failed to update pool" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/pools/[id] - Delete pool
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const pools = getPoolsArray();
    const poolIndex = pools.findIndex((p) => p.id === params.id);
    
    if (poolIndex === -1) {
      return NextResponse.json(
        { error: "Pool not found" },
        { status: 404 }
      );
    }
    
    const deletedPool = pools[poolIndex];
    pools.splice(poolIndex, 1);
    
    console.log("✅ Pool deleted:", deletedPool.name);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting pool:", error);
    return NextResponse.json(
      { error: "Failed to delete pool" },
      { status: 500 }
    );
  }
}