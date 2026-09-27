import { ObjectId } from "mongodb";
import { Book, BookDTO } from "./book.model";
import { BookRepository } from "./book.repository";
import { BadRequestError, NotFoundError } from "../../shared/errors/AppError";
import { getDb } from "../../config/database";

export class BookService {
    private readonly bookRepository = new BookRepository();

    async create(data: BookDTO): Promise<Book> {
        const title = this.requireString(data?.title, "title");
        const isbn = this.requireString(data?.isbn, "isbn");
        const authorIdStr = this.requireString(data?.authorId, "authorId");
        const authorId = this.toObjectId(authorIdStr);

        const author = await getDb().collection("authors").findOne({ _id: authorId });
        if (!author) throw new NotFoundError("El autor especificado no existe");

        const existingIsbn = await this.bookRepository.findByIsbn(isbn);
        if (existingIsbn) throw new BadRequestError("El ISBN ya se encuentra registrado");

        const now = new Date();
        return this.bookRepository.create({
            title,
            isbn,
            authorId,
            year: data.year,
            available: true,
            createdAt: now,
            updatedAt: now,
        });
    }

    async findAll(available?: string): Promise<Book[]> {
        const filter: Record<string, unknown> = {};
        if (available !== undefined) {
            filter.available = available === "true";
        }
        return this.bookRepository.findAll(filter);
    }

    async findById(id: string): Promise<Book> {
        const book = await this.bookRepository.findById(this.toObjectId(id));
        if (!book) throw new NotFoundError("Libro no encontrado");
        return book;
    }

    async update(id: string, data: BookDTO): Promise<Book> {
        const objectId = this.toObjectId(id);
        const changes: Partial<Book> = {};

        if (data.title !== undefined) changes.title = this.requireString(data.title, "title");
        if (data.isbn !== undefined) {
            const isbn = this.requireString(data.isbn, "isbn");
            const existingIsbn = await this.bookRepository.findByIsbn(isbn);
            if (existingIsbn && existingIsbn._id?.toString() !== id) {
                throw new BadRequestError("El ISBN ya pertenece a otro libro");
            }
            changes.isbn = isbn;
        }
        if (data.authorId !== undefined) {
            const authorId = this.toObjectId(this.requireString(data.authorId, "authorId"));
            const author = await getDb().collection("authors").findOne({ _id: authorId });
            if (!author) throw new NotFoundError("El autor especificado no existe");
            changes.authorId = authorId;
        }
        if (data.year !== undefined) changes.year = data.year;
        if (data.available !== undefined) changes.available = data.available;

        changes.updatedAt = new Date();
        const updated = await this.bookRepository.update(objectId, changes);
        if (!updated) throw new NotFoundError("Libro no encontrado");
        return updated;
    }

    async delete(id: string): Promise<void> {
        const deleted = await this.bookRepository.delete(this.toObjectId(id));
        if (!deleted) throw new NotFoundError("Libro no encontrado");
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