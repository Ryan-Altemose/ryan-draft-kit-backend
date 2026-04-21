import { NextResponse } from 'next/server';
import { UpdateNotebookSchema } from '@/features/Notebooks/types/notebooks.types';
import { notebooksService } from '@/features/Notebooks/server/notebooks.service';
import { connectDb } from '@/shared/server/connect-db';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    await connectDb();

    const { id } = await context.params;
    const notebook = await notebooksService.getNotebookById(id);

    if (!notebook) {
      return NextResponse.json(
        {
          success: false,
          message: 'Notebook not found',
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: notebook,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to fetch notebook';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    await connectDb();

    const { id } = await context.params;
    const payload = UpdateNotebookSchema.parse(await request.json());
    const notebook = await notebooksService.updateNotebook(id, payload);

    if (!notebook) {
      return NextResponse.json(
        {
          success: false,
          message: 'Notebook not found',
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: notebook,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to update notebook';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    await connectDb();

    const { id } = await context.params;
    const notebook = await notebooksService.deleteNotebook(id);

    if (!notebook) {
      return NextResponse.json(
        {
          success: false,
          message: 'Notebook not found',
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: notebook,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to delete notebook';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
