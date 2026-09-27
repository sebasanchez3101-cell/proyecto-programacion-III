import { ObjectId } from "mongodb";
import { Author, AuthorDTO } from "./author.model";
import { Book } from "../book/book.model";
import { AuthorRepository } from "./author.repository";
import { BadRequestError, NotFoundError } from "../../shared/errors/AppError";
import { getDb } from "../../config/database";

export class AuthorService {
    private readonly authorRepository = new AuthorRepository();

    async create(data: AuthorDTO): Promise<Author> {
        const name = this.requireString(data?.name, "name");
        const nationality = this.requireString(data?.nationality, "nationality");

        if (data.birthYear !== undefined) {
            if (!Number.isInteger(data.birthYear) || data.birthYear <= 0) {
                throw new BadRequestError("El campo 'birthYear' debe ser un entero positivo");
            }
        }

        const now = new Date();
        return this.authorRepository.create({
            name,
            nationality,
            birthYear: data.birthYear,
            createdAt: now,
            updatedAt: now,
        });
    }

    async findAll(): Promise<Author[]> {
        return this.authorRepository.findAll();
    }

    async findById(id: string): Promise<Author> {
        const author = await this.authorRepository.findById(this.toObjectId(id));
        if (!author) throw new NotFoundError("Autor no encontrado");
        return author;
    }

    async update(id: string, data: AuthorDTO): Promise<Author> {
        const objectId = this.toObjectId(id);
        const changes: Partial<Author> = {};

        if (data.name !== undefined) changes.name = this.requireString(data.name, "name");
        if (data.nationality !== undefined) changes.nationality = this.requireString(data.nationality, "nationality");
        if (data.birthYear !== undefined) {
            if (!Number.isInteger(data.birthYear) || data.birthYear <= 0) {
                throw new BadRequestError("El campo 'birthYear' debe ser un entero positivo");
            }
            changes.birthYear = data.birthYear;
        }

        if (Object.keys(changes).length === 0) {
            throw new BadRequestError("No se enviaron campos para actualizar");
        }
        changes.updatedAt = new Date();

        const updated = await this.authorRepository.update(objectId, changes);
        if (!updated) throw new NotFoundError("Autor no encontrado");
        return updated;
    }

    async delete(id: string): Promise<void> {
        const objectId = this.toObjectId(id);

        const booksCount = await getDb().collection("books").countDocuments({ authorId: objectId });
        if (booksCount > 0) {
            throw new BadRequestError("No se puede eliminar el autor porque tiene libros asociados");
        }

        const deleted = await this.authorRepository.delete(objectId);
        if (!deleted) throw new NotFoundError("Autor no encontrado");
    }

    async findBooksByAuthor(id: string): Promise<Book[]> {
        const objectId = this.toObjectId(id);
        const author = await this.authorRepository.findById(objectId);
        if (!author) throw new NotFoundError("Autor no encontrado");

        return getDb().collection<Book>("books").find({ authorId: objectId }).toArray();
    }

    private requireString(value: unknown, field: string): string {
        if (typeof value !== "string" || value.trim() === "") {
            throw new BadRequestError(`El campo '${field}' es obligatorio y no puede estar vacío`);
        }
        return value.trim();
    }

    private toObjectId(id: string): ObjectId {
        if (!ObjectId.isValid(id)) throw new BadRequestError(`Identificador inválido: ${id}`);
        return new ObjectId(id);
    }
}