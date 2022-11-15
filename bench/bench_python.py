import sqlite3
import datetime

conn = sqlite3.connect(":memory:")

cursor = conn.cursor()

cursor.execute("PRAGMA auto_vacuum = none")
cursor.execute("PRAGMA temp_store = memory")
cursor.execute("PRAGMA locking_mode = exclusive")
cursor.execute("PRAGMA user_version = 100")

conn.commit()

runs = 1000000
def bench():
    start = datetime.datetime.now()
    for i in range(runs):
        cursor.execute("pragma user_version")
        cursor.fetchone()

    elapsed = datetime.datetime.now() - start;
    rate = runs / elapsed.total_seconds()
    print("time {} ms rate {}".format(round(elapsed.total_seconds() * 1000), round(rate)))

for _ in range(50):
    bench()