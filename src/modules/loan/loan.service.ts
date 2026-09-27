import { ObjectId } from "mongodb";
import { Loan, LoanDTO } from "./loan.model";
import { LoanRepository } from "./loan.repository";
import { BadRequestError, NotFoundError } from "../../shared/errors/AppError";
import { getDb } from "../../config/database";

export class LoanService {
    private readonly loanRepository = new LoanRepository();

    async create(data: LoanDTO): Promise<Loan> {
        const bookIdStr = this.requireString(data?.bookId, "bookId");
        const userName = this.requireString(data?.userName, "userName");
        const bookId = this.toObjectId(bookIdStr);

        const booksCol = getDb().collection("books");
        const book = await booksCol.findOne({ _id: bookId });

        if (!book) throw new NotFoundError("El libro especificado no existe");

        if (!book.available) {
            throw new BadRequestError("El libro solicitado no está disponible para préstamo");
        }

        const now = new Date();
        const loanDate = data.loanDate ? new Date(data.loanDate) : now;

        const loan = await this.loanRepository.create({
            bookId,
            userName,
            loanDate,
            returned: false,
            createdAt: now,
            updatedAt: now,
        });

        await booksCol.updateOne({ _id: bookId }, { $set: { available: false, updatedAt: now } });

        return loan;
    }

    async findAll(activeOnly?: boolean): Promise<Loan[]> {
        const filter: Record<string, unknown> = {};
        if (activeOnly) {
            filter.returned = false;
        }
        return this.loanRepository.findAll(filter);
    }

    async findById(id: string): Promise<Loan> {
        const loan = await this.loanRepository.findById(this.toObjectId(id));
        if (!loan) throw new NotFoundError("Préstamo no encontrado");
        return loan;
    }

    async update(id: string, data: LoanDTO): Promise<Loan> {
        const objectId = this.toObjectId(id);
        const existingLoan = await this.loanRepository.findById(objectId);
        if (!existingLoan) throw new NotFoundError("Préstamo no encontrado");

        const changes: Partial<Loan> = {};
        const now = new Date();

        if (data.userName !== undefined) changes.userName = this.requireString(data.userName, "userName");

        if (data.returned === true && !existingLoan.returned) {
            changes.returned = true;
            changes.returnDate = now;

            await getDb().collection("books").updateOne(
                { _id: existingLoan.bookId },
                { $set: { available: true, updatedAt: now } }
            );
        }

        changes.updatedAt = now;
        const updated = await this.loanRepository.update(objectId, changes);
        if (!updated) throw new NotFoundError("Préstamo no encontrado");
        return updated;
    }

    async delete(id: string): Promise<void> {
        const deleted = await this.loanRepository.delete(this.toObjectId(id));
        if (!deleted) throw new NotFoundError("Préstamo no encontrado");
    }

    private requireString(value: unknown, field: string): string {
        if (typeof value !== "string" || value.trim() === "") {
            throw new BadRequestError(`El campo '${field}' es obligatorio`);
        }
        return value.trim();
    }

    private toObjectId(id: string): ObjectId {
        if (!ObjectId.isValid(id)) throw new BadRequestError(`Identificador inválido: ${id}`);
        return new ObjectId(id);
    }
}