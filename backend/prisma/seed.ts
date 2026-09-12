import { PrismaClient, Role, Workstream, TicketCategory, Priority, MaintenanceAssetCategory, ITAssetCategory, HelpdeskCategory } from "@prisma/client";
import bcrypt from "bcryptjs";
import { nextSequenceValue, formatTicketNumber, formatAssetItemCode, formatHelpdeskTicketNumber } from "../src/modules/sequences/sequence.service";

const prisma = new PrismaClient();

const SEED_PASSWORD = "Soliflex@123";

async function upsertUser(opts: {
  employeeId: string;
  name: string;
  email: string;
  role: Role;
  workstream?: Workstream | null;
  department?: string;
}) {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);
  return prisma.user.upsert({
    where: { email: opts.email },
    update: {},
    create: {
      employeeId: opts.employeeId,
      name: opts.name,
      email: opts.email,
      passwordHash,
      role: opts.role,
      workstream: opts.workstream ?? null,
      department: opts.department,
      mustResetPassword: false,
    },
  });
}

async function main() {
  console.log("Seeding Soliflex ticketing database...");

  const maintenanceManager = await upsertUser({
    employeeId: "EMP-001",
    name: "Ravi Menon",
    email: "ravi.menon@soliflex.local",
    role: Role.MANAGER,
    workstream: Workstream.MAINTENANCE,
    department: "Maintenance",
  });

  const itManager = await upsertUser({
    employeeId: "EMP-002",
    name: "Anita Shah",
    email: "anita.shah@soliflex.local",
    role: Role.MANAGER,
    workstream: Workstream.IT,
    department: "IT",
  });

  const mechanic = await upsertUser({
    employeeId: "EMP-101",
    name: "Suresh Patil",
    email: "suresh.patil@soliflex.local",
    role: Role.MECHANIC,
    workstream: Workstream.MAINTENANCE,
    department: "Maintenance",
  });

  const itTech = await upsertUser({
    employeeId: "EMP-201",
    name: "Neha Verma",
    email: "neha.verma@soliflex.local",
    role: Role.IT_TEAM,
    workstream: Workstream.IT,
    department: "IT",
  });

  const productionUser = await upsertUser({
    employeeId: "EMP-301",
    name: "Vikram Singh",
    email: "vikram.singh@soliflex.local",
    role: Role.PRODUCTION,
    workstream: Workstream.MAINTENANCE,
    department: "Production",
  });

  const adminUser = await upsertUser({
    employeeId: "EMP-401",
    name: "Priya Nair",
    email: "priya.nair@soliflex.local",
    role: Role.ADMIN,
    workstream: Workstream.MAINTENANCE,
    department: "Admin",
  });

  const itTeamLead = await upsertUser({
    employeeId: "EMP-501",
    name: "Karan Mehta",
    email: "karan.mehta@soliflex.local",
    role: Role.IT_TEAM_LEAD,
    workstream: Workstream.IT,
    department: "IT",
  });

  const itSupportEngineer = await upsertUser({
    employeeId: "EMP-502",
    name: "Divya Rao",
    email: "divya.rao@soliflex.local",
    role: Role.IT_SUPPORT_ENGINEER,
    workstream: Workstream.IT,
    department: "IT",
  });

  const employeeUser = await upsertUser({
    employeeId: "EMP-601",
    name: "Amit Joshi",
    email: "amit.joshi@soliflexpackaging.com",
    role: Role.EMPLOYEE,
    department: "Production",
  });

  console.log("Seeded users.");

  // --- sample assets ---
  const existingMaintAsset = await prisma.maintenanceAsset.findFirst({ where: { name: "Extrusion Line 3" } });
  const maintenanceAsset =
    existingMaintAsset ??
    (await prisma.$transaction(async (tx) => {
      const seq = await nextSequenceValue(tx as typeof prisma, "asset:MAINTENANCE", 0);
      return tx.maintenanceAsset.create({
        data: {
          itemCode: formatAssetItemCode("MAINTENANCE", seq),
          name: "Extrusion Line 3",
          category: MaintenanceAssetCategory.PRODUCTION_MACHINE,
          model: "EX-3000",
          manufacturer: "Reifenhauser",
          plantLocation: "Plant A - Bay 3",
          specifications: "Blown film extrusion line, 3-layer",
          createdById: adminUser.id,
        },
      });
    }));

  const existingItAsset = await prisma.iTAsset.findFirst({ where: { name: "Server Rack 1 - App Server" } });
  const itAsset =
    existingItAsset ??
    (await prisma.$transaction(async (tx) => {
      const seq = await nextSequenceValue(tx as typeof prisma, "asset:IT", 0);
      return tx.iTAsset.create({
        data: {
          itemCode: formatAssetItemCode("IT", seq),
          name: "Server Rack 1 - App Server",
          category: ITAssetCategory.SERVER,
          serialNumber: "SN-APP-0091",
          ipAddress: "10.10.1.20",
          vendor: "Dell",
          costCenter: "CC-IT-01",
          createdById: itManager.id,
        },
      });
    }));

  console.log("Seeded assets.");

  // --- sample ticket ---
  const existingTicket = await prisma.ticket.findFirst({ where: { title: "Extrusion Line 3 - unusual vibration" } });
  if (!existingTicket) {
    await prisma.$transaction(async (tx) => {
      const seq = await nextSequenceValue(tx as typeof prisma, `ticket:${Workstream.MAINTENANCE}`, 1000);
      const ticket = await tx.ticket.create({
        data: {
          ticketNumber: formatTicketNumber(Workstream.MAINTENANCE, seq),
          workstream: Workstream.MAINTENANCE,
          category: TicketCategory.PRODUCTION_MACHINE,
          title: "Extrusion Line 3 - unusual vibration",
          description: "Operator reported unusual vibration and noise from the main drive motor during the night shift.",
          plantLocation: "Plant A - Bay 3",
          maintenanceAssetId: maintenanceAsset.id,
          reportedById: productionUser.id,
          managerId: maintenanceManager.id,
          assignedToId: mechanic.id,
          priority: Priority.HIGH,
          status: "ASSIGNED",
        },
      });
      await tx.ticketStatusHistory.create({ data: { ticketId: ticket.id, toStatus: "OPEN", changedById: productionUser.id, comment: "Ticket raised" } });
      await tx.ticketStatusHistory.create({ data: { ticketId: ticket.id, fromStatus: "OPEN", toStatus: "ASSIGNED", changedById: maintenanceManager.id, comment: `Assigned to ${mechanic.name}` } });
    });
    console.log("Seeded sample ticket.");
  }

  // --- sample helpdesk ticket ---
  const existingHelpdeskTicket = await prisma.helpdeskTicket.findFirst({ where: { title: "Laptop won't power on" } });
  if (!existingHelpdeskTicket) {
    await prisma.$transaction(async (tx) => {
      const seq = await nextSequenceValue(tx as typeof prisma, "helpdesk-ticket", 1000);
      const ticket = await tx.helpdeskTicket.create({
        data: {
          ticketNumber: formatHelpdeskTicketNumber(seq),
          category: HelpdeskCategory.LAPTOP_DESKTOP,
          title: "Laptop won't power on",
          description: "Laptop was working fine yesterday, this morning it doesn't turn on even when plugged in.",
          raisedById: employeeUser.id,
          teamLeadId: itTeamLead.id,
          assignedToId: itSupportEngineer.id,
          status: "ASSIGNED",
          priority: Priority.HIGH,
          deadline: new Date(Date.now() + 24 * 3_600_000),
          deadlineSetAt: new Date(),
        },
      });
      await tx.helpdeskStatusHistory.create({ data: { ticketId: ticket.id, toStatus: "OPEN", changedById: employeeUser.id, comment: "Ticket raised" } });
      await tx.helpdeskStatusHistory.create({ data: { ticketId: ticket.id, fromStatus: "OPEN", toStatus: "ASSIGNED", changedById: itTeamLead.id, comment: `Assigned to ${itSupportEngineer.name}` } });
      await tx.helpdeskComment.create({ data: { ticketId: ticket.id, authorId: itSupportEngineer.id, body: "Picking this up now, will swap the charger first to rule that out." } });
    });
    console.log("Seeded sample helpdesk ticket.");
  }

  console.log("\nSeed complete. Login with any of the following (password for all: " + SEED_PASSWORD + "):");
  console.log("  Maintenance Manager:  ravi.menon@soliflex.local");
  console.log("  IT Manager:           anita.shah@soliflex.local");
  console.log("  Mechanic:             suresh.patil@soliflex.local");
  console.log("  IT Team:              neha.verma@soliflex.local");
  console.log("  Production:           vikram.singh@soliflex.local");
  console.log("  Admin:                priya.nair@soliflex.local");
  console.log("  IT Team Lead:         karan.mehta@soliflex.local");
  console.log("  IT Support Engineer:  divya.rao@soliflex.local");
  console.log("  Employee:             amit.joshi@soliflexpackaging.com");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
