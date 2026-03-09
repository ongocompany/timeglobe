import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { id, status, comment } = body;

        const filePath = path.join(process.cwd(), 'data', 'validation_temp.json');
        if (!fs.existsSync(filePath)) {
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const itemIndex = data.findIndex((item: any) => item.id === id);

        if (itemIndex === -1) {
            return NextResponse.json({ error: 'Item not found' }, { status: 404 });
        }

        data[itemIndex].status = status;
        data[itemIndex].comment = comment;

        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

        return NextResponse.json({ success: true, item: data[itemIndex] });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
