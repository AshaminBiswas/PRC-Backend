import { Request, Response, NextFunction } from 'express';
import * as projectsService from './projects.service';
import { sendSuccess } from '../../utils/response';

export const getPublicProjects = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await projectsService.listProjects(req.query as any, false);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

export const getProjectById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await projectsService.getProjectById(req.params.id);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

export const getMapLocations = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await projectsService.getMapLocationsSummary();
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

export const getCategories = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await projectsService.getCategoriesSummary();
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

export const listAdminProjects = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await projectsService.listProjects(req.query as any, true);
    sendSuccess(res, data);
  } catch (error) {
    next(error);
  }
};

export const createProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await projectsService.createProject(req.body);
    sendSuccess(res, data, 'Project created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const updateProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await projectsService.updateProject(req.params.id, req.body);
    sendSuccess(res, data, 'Project updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await projectsService.deleteProject(req.params.id);
    sendSuccess(res, data, 'Project deleted successfully');
  } catch (error) {
    next(error);
  }
};

export const toggleFeatured = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await projectsService.toggleFeatured(req.params.id);
    sendSuccess(res, data, 'Project featured status updated');
  } catch (error) {
    next(error);
  }
};

export const toggleStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await projectsService.toggleStatus(req.params.id);
    sendSuccess(res, data, 'Project status updated');
  } catch (error) {
    next(error);
  }
};

export const seedProjects = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const force = req.query.force === 'true';
    const data = await projectsService.seedInitialProjects(force);
    sendSuccess(res, data, 'Initial projects seed completed');
  } catch (error) {
    next(error);
  }
};
