import { NextResponse } from 'next/server';
import {
  CreateNotebookSchema,
  NotebookFiltersSchema,
} from '@/features/Notebooks/types/notebooks.types';
import { notebooksService } from '@/features/Notebooks/server/notebooks.service';
import { connectDb } from '@/shared/server/connect-db';

export async function GET(request: Request) {
  try {
    await connectDb();

    const filters = NotebookFiltersSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );
    const notebooks = await notebooksService.listNotebooks(filters);

    return NextResponse.json({
      success: true,
      data: notebooks,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to fetch notebooks';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await connectDb();

    const payload = CreateNotebookSchema.parse(await request.json());
    const notebook = await notebooksService.createNotebook(payload);

    return NextResponse.json(
      {
        success: true,
        data: notebook,
      },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to save notebook';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
