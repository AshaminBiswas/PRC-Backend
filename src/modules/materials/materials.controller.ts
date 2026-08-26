import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response';
import * as materialsService from './materials.service';
import { CreateMaterialSchema, UpdateMaterialSchema, ListMaterialsQuerySchema } from './materials.schema';

export const listMaterialsHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = ListMaterialsQuerySchema.parse(req.query);
    const data = await materialsService.listMaterials(query);
    sendSuccess(res, data, 'Materials retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const getMaterialHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const idOrSlug = req.params.idOrSlug as string;
    const data = await materialsService.getMaterialByIdOrSlug(idOrSlug);
    sendSuccess(res, data, 'Material retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const createMaterialHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = CreateMaterialSchema.parse(req.body);
    const data = await materialsService.createMaterial(body);
    sendSuccess(res, data, 'Material created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const updateMaterialHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const body = UpdateMaterialSchema.parse(req.body);
    const data = await materialsService.updateMaterial(id, body);
    sendSuccess(res, data, 'Material updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteMaterialHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const data = await materialsService.deleteMaterial(id);
    sendSuccess(res, data, 'Material deleted successfully');
  } catch (error) {
    next(error);
  }
};
