import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, setDoc, Timestamp, updateDoc, writeBatch } from 'firebase/firestore'
import { afterAll, beforeAll, describe, it } from 'vitest'

/**
 * Suite de Seguridad Multi-Tenant & RBAC contra `firestore.rules` reales.
 * Requiere Firestore Emulator corriendo (`FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`).
 */
const hasEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST)
const describeLive = hasEmulator ? describe : describe.skip

describeLive('Firestore Security Rules — Multi-Tenant, RBAC, Inmutabilidad y Kill Switch', () => {
  let testEnv: RulesTestEnvironment

  const storeA = 'store-a'
  const storeB = 'store-b'
  const ownerA = 'uid-owner-a'
  const adminA = 'uid-admin-a'
  const empA = 'uid-emp-a'
  const ownerB = 'uid-owner-b'

  beforeAll(async () => {
    const [host, portStr] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':')
    testEnv = await initializeTestEnvironment({
      projectId: 'cuentia-rules-test',
      firestore: {
        host,
        port: Number(portStr),
        rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'),
      },
    })

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, 'stores', storeA), {
        ownerUserId: ownerA,
        name: 'Tienda A',
        slug: 'tienda-a',
        currencyCode: 'COP',
        currencyMinorExponent: 0,
        timezone: 'America/Bogota',
        allowNegativeBalance: false,
        status: 'active',
      })
      await setDoc(doc(db, 'stores', storeA, 'members', ownerA), {
        storeId: storeA,
        userId: ownerA,
        role: 'owner',
        status: 'active',
      })
      await setDoc(doc(db, 'stores', storeA, 'members', adminA), {
        storeId: storeA,
        userId: adminA,
        role: 'admin',
        status: 'active',
      })
      await setDoc(doc(db, 'stores', storeA, 'members', empA), {
        storeId: storeA,
        userId: empA,
        role: 'employee',
        status: 'active',
      })
      await setDoc(doc(db, 'stores', storeA, 'auditLogs', 'log-1'), {
        storeId: storeA,
        actorUserId: ownerA,
        action: 'store.created',
      })
      await setDoc(doc(db, 'stores', storeA, 'customers', 'cust-a-debt'), {
        storeId: storeA,
        fullName: 'Don Carlos',
        creditStatus: 'active',
        creditLimit: 200000,
        currentBalance: 50000,
        lastLedgerSeq: 1,
        createdBy: ownerA,
      })
      await setDoc(doc(db, 'stores', storeA, 'customers', 'cust-a-zero'), {
        storeId: storeA,
        fullName: 'Doña Rosa',
        creditStatus: 'active',
        creditLimit: null,
        currentBalance: 0,
        lastLedgerSeq: 0,
        createdBy: ownerA,
      })
      await setDoc(doc(db, 'stores', storeB), {
        ownerUserId: ownerB,
        name: 'Tienda B',
        slug: 'tienda-b',
        currencyCode: 'COP',
        currencyMinorExponent: 0,
        timezone: 'America/Bogota',
        allowNegativeBalance: false,
        status: 'active',
      })
      await setDoc(doc(db, 'stores', storeB, 'members', ownerB), {
        storeId: storeB,
        userId: ownerB,
        role: 'owner',
        status: 'active',
      })
    })
  })

  afterAll(async () => {
    if (testEnv) await testEnv.cleanup()
  })

  it('usuario anónimo no puede leer ni escribir tiendas ni miembros', async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(anonDb, 'stores', storeA)))
    await assertFails(getDoc(doc(anonDb, 'stores', storeA, 'members', ownerA)))
  })

  it('aislamiento cross-tenant: ownerB no puede leer ni editar Tienda A ni sus logs', async () => {
    const dbB = testEnv.authenticatedContext(ownerB, { email: 'owner.b@cuentia.test' }).firestore()
    await assertFails(getDoc(doc(dbB, 'stores', storeA)))
    await assertFails(getDoc(doc(dbB, 'stores', storeA, 'auditLogs', 'log-1')))
    await assertFails(updateDoc(doc(dbB, 'stores', storeA), { name: 'Hackeada' }))
  })

  it('inmutabilidad de auditLogs: incluso ownerA no puede modificar ni borrar registros de auditoría', async () => {
    const dbA = testEnv.authenticatedContext(ownerA, { email: 'owner.a@cuentia.test' }).firestore()
    await assertSucceeds(getDoc(doc(dbA, 'stores', storeA, 'auditLogs', 'log-1')))
    await assertFails(updateDoc(doc(dbA, 'stores', storeA, 'auditLogs', 'log-1'), { action: 'editado' }))
    await assertFails(deleteDoc(doc(dbA, 'stores', storeA, 'auditLogs', 'log-1')))
  })

  it('RBAC y anti-escalamiento: employee no lee auditLogs ni invita; admin no revoca owner', async () => {
    const dbEmp = testEnv.authenticatedContext(empA, { email: 'emp.a@cuentia.test' }).firestore()
    await assertFails(getDoc(doc(dbEmp, 'stores', storeA, 'auditLogs', 'log-1')))
    await assertFails(
      setDoc(doc(dbEmp, 'invitations', 'hash-emp-attempt'), {
        storeId: storeA,
        invitedEmail: 'otro@cuentia.test',
        role: 'employee',
        status: 'pending',
        invitedBy: empA,
        expiresAt: Timestamp.fromMillis(Date.now() + 3600_000),
      }),
    )

    const dbAdmin = testEnv.authenticatedContext(adminA, { email: 'admin.a@cuentia.test' }).firestore()
    await assertFails(
      updateDoc(doc(dbAdmin, 'stores', storeA, 'members', ownerA), { status: 'revoked' }),
    )
  })

  it('clientes: aislamiento cross-tenant, bloqueo de currentBalance y reglas de estado/rol', async () => {
    const dbOwnerB = testEnv.authenticatedContext(ownerB, { email: 'owner.b@cuentia.test' }).firestore()
    await assertFails(getDoc(doc(dbOwnerB, 'stores', storeA, 'customers', 'cust-a-debt')))
    await assertFails(updateDoc(doc(dbOwnerB, 'stores', storeA, 'customers', 'cust-a-debt'), { fullName: 'Hack' }))

    const dbOwnerA = testEnv.authenticatedContext(ownerA, { email: 'owner.a@cuentia.test' }).firestore()
    // Imposible mutar currentBalance desde update directo incluso como owner
    await assertFails(updateDoc(doc(dbOwnerA, 'stores', storeA, 'customers', 'cust-a-debt'), { currentBalance: 0 }))
    // Imposible archivar un cliente con deuda != 0 (`BR-16`, `CL-08`)
    await assertFails(updateDoc(doc(dbOwnerA, 'stores', storeA, 'customers', 'cust-a-debt'), { creditStatus: 'archived' }))
    // Sí puede pasar a frozen con deuda o archivar estando en 0
    await assertSucceeds(updateDoc(doc(dbOwnerA, 'stores', storeA, 'customers', 'cust-a-debt'), { creditStatus: 'frozen' }))
    await assertSucceeds(updateDoc(doc(dbOwnerA, 'stores', storeA, 'customers', 'cust-a-zero'), { creditStatus: 'archived' }))

    // Employee puede editar contacto pero no creditLimit ni creditStatus
    const dbEmpA = testEnv.authenticatedContext(empA, { email: 'emp.a@cuentia.test' }).firestore()
    await assertSucceeds(updateDoc(doc(dbEmpA, 'stores', storeA, 'customers', 'cust-a-debt'), { nickname: 'El vecino' }))
    await assertFails(updateDoc(doc(dbEmpA, 'stores', storeA, 'customers', 'cust-a-debt'), { creditLimit: 900000 }))
    await assertFails(updateDoc(doc(dbEmpA, 'stores', storeA, 'customers', 'cust-a-debt'), { creditStatus: 'active' }))
    // Nunca borrado físico
    await assertFails(deleteDoc(doc(dbOwnerA, 'stores', storeA, 'customers', 'cust-a-zero')))
  })

  it('ledger inmutable: batch atómico válido, bloqueo de sobrepago, bloqueo en frozen y anti-doble-reversión', async () => {
    const dbOwnerA = testEnv.authenticatedContext(ownerA, { email: 'owner.a@cuentia.test' }).firestore()
    const dbEmpA = testEnv.authenticatedContext(empA, { email: 'emp.a@cuentia.test' }).firestore()

    // cust-a-debt quedó en frozen con saldo 50.000 -> employee no puede fiarle, pero sí cobrar abono válido
    const frozenSaleBatch = writeBatch(dbEmpA)
    frozenSaleBatch.set(doc(dbEmpA, 'stores', storeA, 'ledgerEntries', 'idem-frozen-sale'), {
      storeId: storeA,
      customerId: 'cust-a-debt',
      customerSeq: 2,
      entryType: 'credit_sale',
      signedAmount: 10000,
      balanceBefore: 50000,
      balanceAfter: 60000,
      paymentMethod: null,
      reversesEntryId: null,
      idempotencyKey: 'idem-frozen-sale',
      businessDate: '2026-11-19',
      createdBy: empA,
    })
    frozenSaleBatch.update(doc(dbEmpA, 'stores', storeA, 'customers', 'cust-a-debt'), {
      currentBalance: 60000,
      lastLedgerSeq: 2,
      lastLedgerEntryId: 'idem-frozen-sale',
    })
    await assertFails(frozenSaleBatch.commit())

    // Sobrepago (> 50.000 con allowNegativeBalance=false) rechazado
    const overpayBatch = writeBatch(dbOwnerA)
    overpayBatch.set(doc(dbOwnerA, 'stores', storeA, 'ledgerEntries', 'idem-overpay'), {
      storeId: storeA,
      customerId: 'cust-a-debt',
      customerSeq: 2,
      entryType: 'payment',
      signedAmount: -60000,
      balanceBefore: 50000,
      balanceAfter: -10000,
      paymentMethod: 'cash',
      reversesEntryId: null,
      idempotencyKey: 'idem-overpay',
      businessDate: '2026-11-19',
      createdBy: ownerA,
    })
    overpayBatch.update(doc(dbOwnerA, 'stores', storeA, 'customers', 'cust-a-debt'), {
      currentBalance: -10000,
      lastLedgerSeq: 2,
      lastLedgerEntryId: 'idem-overpay',
    })
    await assertFails(overpayBatch.commit())

    // Abono válido atómico de 20.000 -> saldo 30.000
    const payBatch = writeBatch(dbOwnerA)
    payBatch.set(doc(dbOwnerA, 'stores', storeA, 'ledgerEntries', 'idem-pay-1'), {
      storeId: storeA,
      customerId: 'cust-a-debt',
      customerSeq: 2,
      entryType: 'payment',
      signedAmount: -20000,
      balanceBefore: 50000,
      balanceAfter: 30000,
      paymentMethod: 'nequi',
      reversesEntryId: null,
      idempotencyKey: 'idem-pay-1',
      businessDate: '2026-11-19',
      createdBy: ownerA,
    })
    payBatch.update(doc(dbOwnerA, 'stores', storeA, 'customers', 'cust-a-debt'), {
      currentBalance: 30000,
      lastLedgerSeq: 2,
      lastLedgerEntryId: 'idem-pay-1',
    })
    await assertSucceeds(payBatch.commit())

    // Inmutabilidad total: nadie puede editar ni borrar el asiento creado
    await assertFails(updateDoc(doc(dbOwnerA, 'stores', storeA, 'ledgerEntries', 'idem-pay-1'), { signedAmount: -5000 }))
    await assertFails(deleteDoc(doc(dbOwnerA, 'stores', storeA, 'ledgerEntries', 'idem-pay-1')))
  })

  it('Kill Switch inmediato: al revocar a empA pierde lectura inmediata sobre Tienda A', async () => {
    const dbOwner = testEnv.authenticatedContext(ownerA, { email: 'owner.a@cuentia.test' }).firestore()
    const batch = writeBatch(dbOwner)
    batch.update(doc(dbOwner, 'stores', storeA, 'members', empA), { status: 'revoked' })
    await assertSucceeds(batch.commit())

    const dbEmp = testEnv.authenticatedContext(empA, { email: 'emp.a@cuentia.test' }).firestore()
    await assertFails(getDoc(doc(dbEmp, 'stores', storeA)))
  })
})
