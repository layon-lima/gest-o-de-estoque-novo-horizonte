from apscheduler.schedulers.background import BackgroundScheduler

from app.db.database import SessionLocal
from app.services.consistencia_estoque import verificar_consistencia_estoque


scheduler = BackgroundScheduler(
    timezone="America/Sao_Paulo"
)


def executar_verificacao_automatica():
    db = SessionLocal()

    try:
        resultado = verificar_consistencia_estoque(db)

        print(
            "[ESTOQUE] Verificacao automatica concluida:",
            resultado["produtos_com_divergencia"],
            "divergencia(s).",
        )

    except Exception as erro:
        db.rollback()
        print(
            "[ESTOQUE] Erro na verificacao automatica:",
            erro,
        )

    finally:
        db.close()


def iniciar_agendador():
    if scheduler.running:
        return

    scheduler.add_job(
        executar_verificacao_automatica,
        trigger="cron",
        minute=0,
        id="verificacao_consistencia_estoque",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )

    scheduler.start()


def parar_agendador():
    if scheduler.running:
        scheduler.shutdown(wait=False)
